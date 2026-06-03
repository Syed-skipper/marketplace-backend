import { prisma } from '../../../config/database/prisma.client';
import { DomainError, NotFoundError } from '../../../common/exceptions/errors';
import { eventBus } from '../../../common/events/event-bus';
import { DomainEventType } from '../../../common/events/domain-events';

export class InventoryService {
  async reserveStock(variantId: string, quantity: number, referenceId: string) {
    return prisma.$transaction(async (tx) => {
      const inventory = await tx.$queryRaw<
        Array<{ id: string; available_stock: number; reserved_stock: number; version: number }>
      >`
        SELECT id, available_stock, reserved_stock, version
        FROM inventory
        WHERE variant_id = ${variantId}::uuid
        FOR UPDATE
      `;

      const row = inventory[0];
      if (!row) throw new NotFoundError('Inventory not found');
      if (row.available_stock < quantity) {
        throw new DomainError('Insufficient stock available');
      }

      const updated = await tx.inventory.update({
        where: { id: row.id },
        data: {
          availableStock: { decrement: quantity },
          reservedStock: { increment: quantity },
          version: { increment: 1 },
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          variantId,
          inventoryId: row.id,
          type: 'RESERVE',
          quantity,
          referenceId,
        },
      });

      await eventBus.publish({
        type: DomainEventType.STOCK_RESERVED,
        payload: { variantId, quantity, referenceId },
        occurredAt: new Date(),
      });

      return updated;
    });
  }

  async releaseStock(variantId: string, quantity: number, referenceId: string) {
    return prisma.$transaction(async (tx) => {
      const inv = await tx.inventory.findUnique({ where: { variantId } });
      if (!inv) throw new NotFoundError('Inventory not found');
      if (inv.reservedStock < quantity) {
        throw new DomainError('Cannot release more than reserved stock');
      }

      const updated = await tx.inventory.update({
        where: { variantId },
        data: {
          availableStock: { increment: quantity },
          reservedStock: { decrement: quantity },
          version: { increment: 1 },
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          variantId,
          inventoryId: inv.id,
          type: 'RELEASE',
          quantity,
          referenceId,
        },
      });

      await eventBus.publish({
        type: DomainEventType.STOCK_RELEASED,
        payload: { variantId, quantity, referenceId },
        occurredAt: new Date(),
      });

      return updated;
    });
  }

  async deductStock(variantId: string, quantity: number, referenceId: string) {
    return prisma.$transaction(async (tx) => {
      const inv = await tx.inventory.findUnique({ where: { variantId } });
      if (!inv) throw new NotFoundError('Inventory not found');
      if (inv.reservedStock < quantity) {
        throw new DomainError('Insufficient reserved stock to deduct');
      }

      const updated = await tx.inventory.update({
        where: { variantId },
        data: {
          reservedStock: { decrement: quantity },
          version: { increment: 1 },
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          variantId,
          inventoryId: inv.id,
          type: 'DEDUCT',
          quantity,
          referenceId,
        },
      });

      await eventBus.publish({
        type: DomainEventType.STOCK_DEDUCTED,
        payload: { variantId, quantity, referenceId },
        occurredAt: new Date(),
      });

      return updated;
    });
  }

  async updateStock(variantId: string, availableStock: number) {
    const inv = await prisma.inventory.findUnique({ where: { variantId } });
    if (!inv) throw new NotFoundError('Inventory not found');

    const [updated] = await prisma.$transaction([
      prisma.inventory.update({
        where: { variantId },
        data: { availableStock, version: { increment: 1 } },
      }),
      prisma.inventoryTransaction.create({
        data: {
          variantId,
          inventoryId: inv.id,
          type: 'ADJUSTMENT',
          quantity: availableStock,
          referenceId: 'manual-adjustment',
        },
      }),
    ]);

    return updated;
  }

  async getHistory(variantId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where: { variantId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.inventoryTransaction.count({ where: { variantId } }),
    ]);
    return { items, total, page, limit };
  }
}
