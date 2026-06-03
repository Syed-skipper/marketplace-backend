import { prisma } from '../../../config/database/prisma.client';

export class AdminService {
  async getDashboard() {
    const [
      totalUsers,
      totalSellers,
      pendingSellers,
      totalOrders,
      totalProducts,
      revenueAgg,
      recentOrders,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.seller.count({ where: { status: 'APPROVED' } }),
      prisma.seller.count({ where: { status: 'PENDING' } }),
      prisma.order.count(),
      prisma.product.count({ where: { status: 'ACTIVE' } }),
      prisma.order.aggregate({
        where: { status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } },
        _sum: { totalAmount: true },
      }),
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true } } },
      }),
    ]);

    return {
      totalUsers,
      totalSellers,
      pendingSellers,
      totalOrders,
      totalProducts,
      totalRevenue: revenueAgg._sum.totalAmount ?? 0,
      recentOrders,
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

  async listUsers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          createdAt: true,
          roles: { include: { role: true } },
        },
      }),
      prisma.user.count(),
    ]);
    return { items, total };
  }
}
