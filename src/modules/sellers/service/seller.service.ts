import { prisma } from '../../../config/database/prisma.client';
import { ConflictError, NotFoundError } from '../../../common/exceptions/errors';
import { eventBus } from '../../../common/events/event-bus';
import { DomainEventType } from '../../../common/events/domain-events';

export class SellerService {
  async register(userId: string, data: {
    businessName: string;
    businessEmail: string;
    gstNumber?: string;
    documents?: object;
  }) {
    const existing = await prisma.seller.findUnique({ where: { userId } });
    if (existing) throw new ConflictError('Seller profile already exists');

    const seller = await prisma.seller.create({
      data: {
        userId,
        businessName: data.businessName,
        businessEmail: data.businessEmail,
        gstNumber: data.gstNumber,
        documents: data.documents,
        status: 'PENDING',
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: (await prisma.role.findUnique({ where: { name: 'seller' } }))!.id } },
      update: {},
      create: {
        userId,
        roleId: (await prisma.role.findUnique({ where: { name: 'seller' } }))!.id,
      },
    });

    await eventBus.publish({
      type: DomainEventType.SELLER_CREATED,
      payload: { sellerId: seller.id, userId },
      occurredAt: new Date(),
    });

    return seller;
  }

  async approve(sellerId: string, adminId: string) {
    const seller = await prisma.seller.update({
      where: { id: sellerId },
      data: { status: 'APPROVED', approvedBy: adminId, approvedAt: new Date() },
    });

    await eventBus.publish({
      type: DomainEventType.SELLER_APPROVED,
      payload: { sellerId, userId: seller.userId },
      occurredAt: new Date(),
    });

    return seller;
  }

  async reject(sellerId: string, note: string) {
    return prisma.seller.update({
      where: { id: sellerId },
      data: { status: 'REJECTED', rejectionNote: note },
    });
  }

  async getByUserId(userId: string) {
    const seller = await prisma.seller.findUnique({ where: { userId } });
    if (!seller) throw new NotFoundError('Seller not found');
    return seller;
  }

  async listPending(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.seller.findMany({
        where: { status: 'PENDING' },
        skip,
        take: limit,
        include: { user: { select: { email: true, firstName: true, lastName: true } } },
      }),
      prisma.seller.count({ where: { status: 'PENDING' } }),
    ]);
    return { items, total };
  }
}
