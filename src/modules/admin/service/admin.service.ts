import { Prisma, ProductStatus, SellerStatus, UserStatus } from '@prisma/client';
import { prisma } from '../../../config/database/prisma.client';
import { ConflictError, DomainError, NotFoundError } from '../../../common/exceptions/errors';
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
        take: 3,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.findMany({
        take: 2,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          action: true,
          entityType: true,
          createdAt: true,
        },
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

  async getAuditLogs(page = 1, limit = 50, search?: string) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const where: Prisma.AuditLogWhereInput = {};
    const q = search?.trim();
    if (q) {
      where.OR = [
        { action: { contains: q, mode: 'insensitive' } },
        { entityType: { contains: q, mode: 'insensitive' } },
        { entityId: { contains: q, mode: 'insensitive' } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true, firstName: true, lastName: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);
    return { items, total, page: safePage, limit: safeLimit };
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
          items: {
            include: {
              product: { select: { name: true, images: { take: 1, orderBy: { sortOrder: 'asc' } } } },
              variant: { select: { sku: true } },
            },
          },
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
        ...(data.role === 'seller'
          ? {
              seller: {
                create: {
                  businessName: `${data.firstName.trim()} ${data.lastName.trim()}`.trim() || 'Pending business',
                  businessEmail: email,
                  status: 'PENDING',
                },
              },
            }
          : {}),
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

  private async writeUserAudit(
    adminId: string,
    action: string,
    userId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action,
        entityType: 'user',
        entityId: userId,
        metadata: metadata ?? {},
        ipAddress: '127.0.0.1',
      },
    });
  }

  async updateUserStatus(id: string, status: UserStatus, adminId: string) {
    if (adminId === id) {
      throw new DomainError('You cannot change your own account status');
    }

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, status: true, email: true },
    });
    if (!existing) throw new NotFoundError('User not found');

    const user = await prisma.user.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        createdAt: true,
        roles: { include: { role: { select: { name: true } } } },
      },
    });

    await this.writeUserAudit(adminId, 'USER_STATUS_UPDATED', id, {
      email: user.email,
      from: existing.status,
      to: status,
    });

    return user;
  }

  async verifyUserEmail(id: string, adminId: string) {
    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, emailVerified: true, status: true },
    });
    if (!existing) throw new NotFoundError('User not found');
    if (existing.emailVerified) {
      return prisma.user.findUnique({
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
          seller: {
            select: {
              id: true,
              businessName: true,
              businessEmail: true,
              gstNumber: true,
              status: true,
              createdAt: true,
              approvedAt: true,
            },
          },
        },
      });
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        ...(existing.status === 'PENDING_VERIFICATION' ? { status: 'ACTIVE' } : {}),
      },
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
        seller: {
          select: {
            id: true,
            businessName: true,
            businessEmail: true,
            gstNumber: true,
            status: true,
            createdAt: true,
            approvedAt: true,
          },
        },
      },
    });

    await this.writeUserAudit(adminId, 'EMAIL_VERIFIED_BY_ADMIN', id, { email: user!.email });
    return user;
  }

  async deleteUser(id: string, adminId: string) {
    if (adminId === id) {
      throw new DomainError('You cannot delete your own account');
    }

    const existing = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        roles: { include: { role: { select: { name: true } } } },
        _count: { select: { orders: true } },
      },
    });
    if (!existing) throw new NotFoundError('User not found');

    const isAdmin = existing.roles.some((r) => r.role.name === 'admin');
    if (isAdmin) {
      throw new DomainError('Admin accounts cannot be deleted');
    }

    if (existing._count.orders > 0) {
      const user = await prisma.user.update({
        where: { id },
        data: { status: 'INACTIVE' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          createdAt: true,
          roles: { include: { role: { select: { name: true } } } },
        },
      });
      await this.writeUserAudit(adminId, 'USER_DEACTIVATED', id, {
        email: existing.email,
        reason: 'has_orders',
      });
      return { user, deactivated: true as const };
    }

    await prisma.user.delete({ where: { id } });
    await this.writeUserAudit(adminId, 'USER_DELETED', id, { email: existing.email });
    return { user: null, deactivated: false as const };
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
        seller: {
          select: {
            id: true,
            businessName: true,
            businessEmail: true,
            gstNumber: true,
            status: true,
            createdAt: true,
            approvedAt: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  async ensureSellerProfile(userId: string, adminId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } }, seller: true },
    });
    if (!user) throw new NotFoundError('User not found');

    const hasSellerRole = user.roles.some((r) => r.role.name === 'seller');
    if (!hasSellerRole) {
      throw new ConflictError('User does not have the seller role');
    }
    if (user.seller) return user.seller;

    const seller = await prisma.seller.create({
      data: {
        userId: user.id,
        businessName: `${user.firstName} ${user.lastName}`.trim() || 'Pending business',
        businessEmail: user.email,
        status: 'PENDING',
      },
    });

    await this.writeUserAudit(adminId, 'SELLER_PROFILE_CREATED', userId, {
      sellerId: seller.id,
      businessEmail: seller.businessEmail,
    });

    return seller;
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

  getSellerApplicationFilters() {
    return {
      statuses: [
        { value: 'all', label: 'All statuses' },
        { value: 'PENDING', label: 'Pending review' },
        { value: 'APPROVED', label: 'Approved' },
        { value: 'REJECTED', label: 'Rejected' },
        { value: 'SUSPENDED', label: 'Suspended' },
      ],
      appliedWithin: [
        { value: 'all', label: 'Any time' },
        { value: '7d', label: 'Last 7 days' },
        { value: '30d', label: 'Last 30 days' },
        { value: '90d', label: 'Last 90 days' },
      ],
    };
  }

  private buildSellerApplicationWhere(query: {
    search?: string;
    status?: string;
    appliedWithin?: string;
  }): Prisma.SellerWhereInput {
    const where: Prisma.SellerWhereInput = {};
    const search = query.search?.trim();

    if (search) {
      where.OR = [
        { businessName: { contains: search, mode: 'insensitive' } },
        { businessEmail: { contains: search, mode: 'insensitive' } },
        { gstNumber: { contains: search, mode: 'insensitive' } },
        {
          user: {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    if (query.status && query.status !== 'all') {
      where.status = query.status as SellerStatus;
    }

    if (query.appliedWithin && query.appliedWithin !== 'all') {
      const dayMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };
      const days = dayMap[query.appliedWithin];
      if (days) {
        const since = new Date();
        since.setDate(since.getDate() - days);
        where.createdAt = { gte: since };
      }
    }

    return where;
  }

  async getSellerApplicationStats() {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [pendingReview, pendingSinceYesterday, approvedThisWeek, rejectedThisWeek, recentApproved] =
      await Promise.all([
        prisma.seller.count({ where: { status: 'PENDING' } }),
        prisma.seller.count({
          where: { status: 'PENDING', createdAt: { gte: oneDayAgo } },
        }),
        prisma.seller.count({
          where: { status: 'APPROVED', approvedAt: { gte: weekAgo } },
        }),
        prisma.seller.count({
          where: { status: 'REJECTED', updatedAt: { gte: weekAgo } },
        }),
        prisma.seller.findMany({
          where: { status: 'APPROVED', approvedAt: { not: null } },
          select: { createdAt: true, approvedAt: true },
          orderBy: { approvedAt: 'desc' },
          take: 200,
        }),
      ]);

    let avgResponseHours = 0;
    if (recentApproved.length > 0) {
      const totalMs = recentApproved.reduce(
        (sum, s) => sum + (s.approvedAt!.getTime() - s.createdAt.getTime()),
        0,
      );
      avgResponseHours = totalMs / recentApproved.length / (1000 * 60 * 60);
    }

    const decided = approvedThisWeek + rejectedThisWeek;
    const acceptanceRate = decided > 0 ? Math.round((approvedThisWeek / decided) * 100) : 0;

    return {
      pendingReview,
      pendingSinceYesterday,
      avgResponseHours: Math.round(avgResponseHours * 10) / 10,
      approvedThisWeek,
      acceptanceRate,
    };
  }

  async listSellerApplications(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    appliedWithin?: string;
  } = {}) {
    const { page, limit, skip } = parsePagination(query, 100);
    const where = this.buildSellerApplicationWhere(query);

    const [items, total, stats] = await Promise.all([
      prisma.seller.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true, firstName: true, lastName: true } },
        },
      }),
      prisma.seller.count({ where }),
      this.getSellerApplicationStats(),
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
      stats,
    };
  }

  async exportSellerApplicationsCsv(query: {
    search?: string;
    status?: string;
    appliedWithin?: string;
  } = {}) {
    const where = this.buildSellerApplicationWhere(query);
    const items = await prisma.seller.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10_000,
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
      },
    });

    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = [
      'Business Name',
      'Business Email',
      'Owner Name',
      'Owner Email',
      'GST Number',
      'Status',
      'Applied At',
      'Approved At',
      'Rejection Note',
    ].join(',');

    const rows = items.map((s) => {
      const ownerName = s.user
        ? `${s.user.firstName} ${s.user.lastName}`.trim()
        : '';
      return [
        escape(s.businessName),
        escape(s.businessEmail),
        escape(ownerName),
        escape(s.user?.email ?? ''),
        escape(s.gstNumber ?? ''),
        escape(s.status),
        escape(s.createdAt.toISOString()),
        escape(s.approvedAt?.toISOString() ?? ''),
        escape(s.rejectionNote ?? ''),
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }

  getProductModerationFilters() {
    return prisma.category
      .findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })
      .then((categories) => ({
        statuses: [
          { value: 'queue', label: 'Needs review (draft & rejected)' },
          { value: 'DRAFT', label: 'Draft / new submissions' },
          { value: 'REJECTED', label: 'Rejected' },
          { value: 'ACTIVE', label: 'Active (published)' },
          { value: 'INACTIVE', label: 'Inactive' },
          { value: 'all', label: 'All statuses' },
        ],
        categories: [
          { value: 'all', label: 'All categories' },
          ...categories.map((c) => ({ value: c.id, label: c.name })),
        ],
      }));
  }

  private buildProductModerationWhere(query: {
    search?: string;
    status?: string;
    categoryId?: string;
  }): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = {};
    const search = query.search?.trim();

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { seller: { businessName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const status = query.status ?? 'queue';
    if (status === 'queue') {
      where.status = { in: ['DRAFT', 'REJECTED'] };
    } else if (status !== 'all') {
      where.status = status as ProductStatus;
    }

    if (query.categoryId && query.categoryId !== 'all') {
      where.categoryId = query.categoryId;
    }

    return where;
  }

  async getProductModerationStats() {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const [draftCount, rejectedCount, approvedToday, queueTotal] = await Promise.all([
      prisma.product.count({ where: { status: 'DRAFT' } }),
      prisma.product.count({ where: { status: 'REJECTED' } }),
      prisma.product.count({
        where: { status: 'ACTIVE', updatedAt: { gte: startOfDay } },
      }),
      prisma.product.count({ where: { status: { in: ['DRAFT', 'REJECTED'] } } }),
    ]);

    return { draftCount, rejectedCount, approvedToday, queueTotal };
  }

  async listProductModeration(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    categoryId?: string;
  } = {}) {
    const { page, limit, skip } = parsePagination(query, 100);
    const where = this.buildProductModerationWhere(query);

    const [items, total, stats] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          images: { orderBy: { sortOrder: 'asc' } },
          variants: { include: { inventory: true } },
          category: { select: { id: true, name: true, slug: true } },
          seller: { select: { id: true, businessName: true, status: true } },
        },
      }),
      prisma.product.count({ where }),
      this.getProductModerationStats(),
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
      stats,
    };
  }

  async getProductModerationById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        variants: { include: { inventory: true } },
        category: true,
        seller: { select: { id: true, businessName: true, status: true } },
      },
    });
    if (!product) throw new NotFoundError('Product not found');
    return product;
  }

  async moderateProduct(
    productId: string,
    adminId: string,
    action: 'approve' | 'reject' | 'request_fix',
    notes?: string,
  ) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError('Product not found');

    let newStatus: ProductStatus;
    let auditAction: string;

    switch (action) {
      case 'approve':
        newStatus = 'ACTIVE';
        auditAction = 'PRODUCT_APPROVED';
        break;
      case 'reject':
        newStatus = 'REJECTED';
        auditAction = 'PRODUCT_REJECTED';
        break;
      case 'request_fix':
        newStatus = 'DRAFT';
        auditAction = 'PRODUCT_CHANGES_REQUESTED';
        break;
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: { status: newStatus },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        variants: { include: { inventory: true } },
        category: { select: { id: true, name: true, slug: true } },
        seller: { select: { id: true, businessName: true, status: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: auditAction,
        entityType: 'product',
        entityId: productId,
        metadata: {
          previousStatus: product.status,
          newStatus,
          notes: notes?.trim() || null,
        },
        ipAddress: '127.0.0.1',
      },
    });

    return updated;
  }

  async getOrderAnalytics(period: '7d' | '30d' | '90d' = '30d') {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);

    const priorEnd = new Date(start);
    priorEnd.setMilliseconds(-1);
    const priorStart = new Date(priorEnd);
    priorStart.setDate(priorStart.getDate() - (days - 1));
    priorStart.setHours(0, 0, 0, 0);

    const [ordersInPeriod, ordersPriorPeriod, statusGroups, highValueOrders] = await Promise.all([
      prisma.order.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { id: true, status: true, totalAmount: true, createdAt: true },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: priorStart, lte: priorEnd } },
        select: { id: true, status: true, totalAmount: true },
      }),
      prisma.order.groupBy({
        by: ['status'],
        where: { createdAt: { gte: start, lte: end } },
        _count: { _all: true },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: start, lte: end } },
        orderBy: { totalAmount: 'desc' },
        take: 8,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          user: { select: { email: true, firstName: true, lastName: true } },
        },
      }),
    ]);

    const revenueStatuses = new Set<string>(REVENUE_STATUSES);
    const revenueInPeriod = ordersInPeriod.filter((o) => revenueStatuses.has(o.status));
    const revenuePrior = ordersPriorPeriod.filter((o) => revenueStatuses.has(o.status));

    const periodRevenue = revenueInPeriod.reduce((s, o) => s + Number(o.totalAmount), 0);
    const priorRevenue = revenuePrior.reduce((s, o) => s + Number(o.totalAmount), 0);
    const orderCount = ordersInPeriod.length;
    const priorOrderCount = ordersPriorPeriod.length;
    const avgOrderValue = revenueInPeriod.length
      ? periodRevenue / revenueInPeriod.length
      : 0;
    const delivered = ordersInPeriod.filter((o) => o.status === 'DELIVERED').length;
    const cancelled = ordersInPeriod.filter((o) => o.status === 'CANCELLED').length;
    const fulfillmentRate = orderCount ? Math.round((delivered / orderCount) * 100) : 0;

    const volumeTrend = this.buildAdminOrderVolumeTrend(ordersInPeriod, start, end, period);

    return {
      period,
      kpis: {
        totalOrders: orderCount,
        ordersTrend: percentChange(orderCount, priorOrderCount),
        revenue: periodRevenue,
        revenueTrend: percentChange(periodRevenue, priorRevenue),
        avgOrderValue,
        fulfillmentRate,
        cancelled,
        pending: ordersInPeriod.filter((o) =>
          PENDING_ORDER_STATUSES.includes(o.status as (typeof PENDING_ORDER_STATUSES)[number]),
        ).length,
      },
      volumeTrend,
      statusBreakdown: statusGroups
        .map((g) => ({ status: g.status, count: g._count._all }))
        .sort((a, b) => b.count - a.count),
      highValueOrders: highValueOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        amount: Number(o.totalAmount),
        createdAt: o.createdAt.toISOString(),
        customerEmail: o.user?.email ?? null,
        customerName: o.user
          ? `${o.user.firstName} ${o.user.lastName}`.trim() || null
          : null,
      })),
    };
  }

  private buildAdminOrderVolumeTrend(
    orders: { createdAt: Date; totalAmount: Prisma.Decimal; status: string }[],
    start: Date,
    end: Date,
    period: '7d' | '30d' | '90d',
  ) {
    const revenueStatuses = new Set<string>(REVENUE_STATUSES);

    if (period === '90d') {
      const bucketCount = 12;
      const buckets = Array.from({ length: bucketCount }, (_, i) => {
        const weekEnd = new Date(end);
        weekEnd.setDate(weekEnd.getDate() - (bucketCount - 1 - i) * 7);
        weekEnd.setHours(23, 59, 59, 999);
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);
        return {
          label: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          orderCount: 0,
          revenue: 0,
        };
      });

      for (const order of orders) {
        const created = new Date(order.createdAt);
        const idx = buckets.findIndex((_, i) => {
          const weekEnd = new Date(end);
          weekEnd.setDate(weekEnd.getDate() - (bucketCount - 1 - i) * 7);
          weekEnd.setHours(23, 59, 59, 999);
          const weekStart = new Date(weekEnd);
          weekStart.setDate(weekStart.getDate() - 6);
          weekStart.setHours(0, 0, 0, 0);
          return created >= weekStart && created <= weekEnd;
        });
        if (idx >= 0) {
          buckets[idx].orderCount += 1;
          if (revenueStatuses.has(order.status)) {
            buckets[idx].revenue += Number(order.totalAmount);
          }
        }
      }
      const maxOrders = Math.max(1, ...buckets.map((b) => b.orderCount));
      const maxRevenue = Math.max(1, ...buckets.map((b) => b.revenue));
      return buckets.map((b) => ({
        ...b,
        orderHeightPct: Math.max(8, Math.round((b.orderCount / maxOrders) * 100)),
        revenueHeightPct: Math.max(8, Math.round((b.revenue / maxRevenue) * 100)),
      }));
    }

    const bucketCount = period === '7d' ? 7 : 14;
    const chartStart =
      period === '7d'
        ? new Date(start)
        : (() => {
            const s = new Date(end);
            s.setDate(s.getDate() - (bucketCount - 1));
            s.setHours(0, 0, 0, 0);
            return s;
          })();

    const buckets = Array.from({ length: bucketCount }, (_, i) => {
      const d = new Date(chartStart);
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      return {
        label:
          period === '7d'
            ? d.toLocaleDateString('en-US', { weekday: 'short' })
            : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        orderCount: 0,
        revenue: 0,
        dayStart: d.getTime(),
      };
    });

    for (const order of orders) {
      const created = new Date(order.createdAt);
      created.setHours(0, 0, 0, 0);
      const idx = Math.floor((created.getTime() - chartStart.getTime()) / 86_400_000);

      if (idx >= 0 && idx < bucketCount) {
        buckets[idx].orderCount += 1;
        if (revenueStatuses.has(order.status)) {
          buckets[idx].revenue += Number(order.totalAmount);
        }
      }
    }

    const maxOrders = Math.max(1, ...buckets.map((b) => b.orderCount));
    const maxRevenue = Math.max(1, ...buckets.map((b) => b.revenue));
    return buckets.map(({ label, orderCount, revenue }) => ({
      label,
      orderCount,
      revenue,
      orderHeightPct: Math.max(8, Math.round((orderCount / maxOrders) * 100)),
      revenueHeightPct: Math.max(8, Math.round((revenue / maxRevenue) * 100)),
    }));
  }
}
