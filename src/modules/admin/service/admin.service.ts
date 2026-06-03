import { Prisma, UserStatus } from '@prisma/client';
import { prisma } from '../../../config/database/prisma.client';
import { ConflictError, NotFoundError } from '../../../common/exceptions/errors';
import { parsePagination } from '../../../common/types/pagination.types';
import { hashPassword } from '../../../common/utils/hash.util';

const REVENUE_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;
const PENDING_ORDER_STATUSES = ['PENDING', 'PAYMENT_PENDING', 'PROCESSING'] as const;

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function last12MonthKeys(): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(monthKey(d));
  }
  return keys;
}

function percentChange(current: number, previous: number): { text: string; up: boolean } {
  if (previous === 0) {
    return { text: current > 0 ? '+100%' : '0%', up: current >= 0 };
  }
  const pct = ((current - previous) / previous) * 100;
  const up = pct >= 0;
  return { text: `${up ? '+' : ''}${pct.toFixed(1)}%`, up };
}

function progressPercent(value: number, cap: number): string {
  return `${Math.min(100, Math.round((value / cap) * 100))}%`;
}

export class AdminService {
  async getDashboard() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const monthKeys = last12MonthKeys();

    const [
      totalUsers,
      totalSellers,
      pendingSellers,
      totalOrders,
      pendingOrders,
      totalProducts,
      activeProducts,
      productsPendingModeration,
      revenueAgg,
      recentOrders,
      recentAuditLogs,
      ordersLast30,
      ordersPrev30,
      usersLast30,
      usersPrev30,
      sellersLast30,
      revenueLast30Agg,
      revenuePrev30Agg,
      ordersForChart,
      sellersForChart,
      activeUsers,
      deliveredOrders,
      successPayments,
      totalPayments,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.seller.count({ where: { status: 'APPROVED' } }),
      prisma.seller.count({ where: { status: 'PENDING' } }),
      prisma.order.count(),
      prisma.order.count({ where: { status: { in: [...PENDING_ORDER_STATUSES] } } }),
      prisma.product.count(),
      prisma.product.count({ where: { status: 'ACTIVE' } }),
      prisma.product.count({ where: { status: { in: ['DRAFT', 'REJECTED'] } } }),
      prisma.order.aggregate({
        where: { status: { in: [...REVENUE_STATUSES] } },
        _sum: { totalAmount: true },
      }),
      prisma.order.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true, firstName: true, lastName: true } } },
      }),
      prisma.auditLog.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true } } },
      }),
      prisma.order.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.order.count({
        where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      }),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.user.count({
        where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      }),
      prisma.seller.count({
        where: { status: 'APPROVED', approvedAt: { gte: thirtyDaysAgo } },
      }),
      prisma.order.aggregate({
        where: {
          status: { in: [...REVENUE_STATUSES] },
          createdAt: { gte: thirtyDaysAgo },
        },
        _sum: { totalAmount: true },
      }),
      prisma.order.aggregate({
        where: {
          status: { in: [...REVENUE_STATUSES] },
          createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
        },
        _sum: { totalAmount: true },
      }),
      prisma.order.findMany({
        where: {
          status: { in: [...REVENUE_STATUSES] },
          createdAt: { gte: twelveMonthsAgo },
        },
        select: { totalAmount: true, createdAt: true },
      }),
      prisma.seller.findMany({
        where: {
          status: 'APPROVED',
          OR: [
            { approvedAt: { gte: twelveMonthsAgo } },
            { approvedAt: null, createdAt: { gte: twelveMonthsAgo } },
          ],
        },
        select: { approvedAt: true, createdAt: true },
      }),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.order.count({ where: { status: 'DELIVERED' } }),
      prisma.payment.count({ where: { status: 'SUCCESS' } }),
      prisma.payment.count(),
    ]);

    const revenueByMonth: Record<string, number> = Object.fromEntries(monthKeys.map((k) => [k, 0]));
    for (const order of ordersForChart) {
      const key = monthKey(order.createdAt);
      if (key in revenueByMonth) {
        revenueByMonth[key] += Number(order.totalAmount);
      }
    }

    const sellersByMonth: Record<string, number> = Object.fromEntries(monthKeys.map((k) => [k, 0]));
    for (const seller of sellersForChart) {
      const date = seller.approvedAt ?? seller.createdAt;
      const key = monthKey(date);
      if (key in sellersByMonth) {
        sellersByMonth[key] += 1;
      }
    }

    const revenueLast30 = Number(revenueLast30Agg._sum.totalAmount ?? 0);
    const revenuePrev30 = Number(revenuePrev30Agg._sum.totalAmount ?? 0);
    const totalRevenue = Number(revenueAgg._sum.totalAmount ?? 0);

    const userTrend = percentChange(usersLast30, usersPrev30);
    const sellerTrend = percentChange(sellersLast30, Math.max(0, totalSellers - sellersLast30));
    const orderTrend = percentChange(ordersLast30, ordersPrev30);
    const revenueTrend = percentChange(revenueLast30, revenuePrev30);

    return {
      totalUsers,
      totalSellers,
      pendingSellers,
      totalOrders,
      pendingOrders,
      totalProducts,
      activeProducts,
      productsPendingModeration,
      totalRevenue,
      recentOrders,
      recentAuditLogs,
      chart: {
        months: monthKeys.map((k) => {
          const [, m] = k.split('-');
          const names = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
          return names[Number(m) - 1] ?? k;
        }),
        revenue: monthKeys.map((k) => revenueByMonth[k] ?? 0),
        sellers: monthKeys.map((k) => sellersByMonth[k] ?? 0),
      },
      trends: {
        users: userTrend,
        sellers: sellerTrend,
        orders: orderTrend,
        revenue: revenueTrend,
      },
      health: {
        activeUsersPercent: totalUsers ? Math.round((activeUsers / totalUsers) * 100) : 0,
        fulfillmentPercent: totalOrders ? Math.round((deliveredOrders / totalOrders) * 100) : 0,
        paymentSuccessPercent: totalPayments ? Math.round((successPayments / totalPayments) * 100) : 0,
        catalogActivePercent: totalProducts ? Math.round((activeProducts / totalProducts) * 100) : 0,
      },
      governance: {
        pendingSellerApprovals: pendingSellers,
        productsAwaitingModeration: productsPendingModeration,
        auditLogCount: await prisma.auditLog.count(),
      },
    };
  }

  async getAuditLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true } } },
      }),
      prisma.auditLog.count(),
    ]);
    return { items, total };
  }

  async listOrders(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true, firstName: true, lastName: true } },
          items: { include: { product: { select: { name: true } } } },
          payments: true,
          shipments: true,
        },
      }),
      prisma.order.count(),
    ]);
    return { items, total };
  }

  async listUsers(query: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    status?: string;
  } = {}) {
    const { page, limit, skip } = parsePagination(query, 100);
    const search = query.search?.trim();
    const roleFilter = query.role?.trim().toLowerCase();
    const statusFilter = query.status?.trim();

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (roleFilter && roleFilter !== 'all') {
      where.roles = { some: { role: { name: roleFilter } } };
    }

    if (statusFilter && statusFilter !== 'all') {
      const statusMap: Record<string, UserStatus | UserStatus[]> = {
        Active: 'ACTIVE',
        Pending: 'PENDING_VERIFICATION',
        Suspended: ['SUSPENDED', 'INACTIVE'],
      };
      const dbStatus = statusMap[statusFilter];
      if (dbStatus) {
        where.status = Array.isArray(dbStatus) ? { in: dbStatus } : dbStatus;
      }
    }

    const [items, total, activeUsers, adminRoleCount, sellerRoleCount, customerRoleCount] =
      await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
            createdAt: true,
            roles: { include: { role: { select: { name: true } } } },
          },
        }),
        prisma.user.count({ where }),
        prisma.user.count({ where: { status: 'ACTIVE' } }),
        prisma.userRole.count({ where: { role: { name: 'admin' } } }),
        prisma.userRole.count({ where: { role: { name: 'seller' } } }),
        prisma.userRole.count({ where: { role: { name: 'customer' } } }),
      ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      summary: {
        totalUsers: await prisma.user.count(),
        activeUsers,
        filteredTotal: total,
        roleCounts: {
          admin: adminRoleCount,
          seller: sellerRoleCount,
          customer: customerRoleCount,
        },
      },
    };
  }

  async createUser(
    data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone?: string | null;
      role: 'admin' | 'seller' | 'customer';
      status?: UserStatus;
    },
    createdByAdminId?: string,
  ) {
    const email = data.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictError('Email already registered');

    const role = await prisma.role.findUnique({ where: { name: data.role } });
    if (!role) throw new NotFoundError(`Role "${data.role}" not found`);

    const passwordHash = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        phone: data.phone?.trim() || null,
        status: data.status ?? 'ACTIVE',
        emailVerified: true,
        roles: {
          create: { roleId: role.id },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        createdAt: true,
        roles: { include: { role: { select: { name: true } } } },
      },
    });

    if (createdByAdminId) {
      await prisma.auditLog.create({
        data: {
          userId: createdByAdminId,
          action: 'USER_CREATED',
          entityType: 'user',
          entityId: user.id,
          metadata: { email: user.email, role: data.role },
          ipAddress: '127.0.0.1',
        },
      });
    }

    return user;
  }

  async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        emailVerified: true,
        createdAt: true,
        roles: { include: { role: { select: { name: true } } } },
        addresses: true,
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            createdAt: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  async listPayments(page = 1, limit = 30) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.payment.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              user: { select: { email: true } },
            },
          },
        },
      }),
      prisma.payment.count(),
    ]);
    return { items, total };
  }
}
