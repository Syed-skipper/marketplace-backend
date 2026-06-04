import { prisma } from '../../../config/database/prisma.client';
import { NotFoundError, DomainError } from '../../../common/exceptions/errors';
import { InventoryService } from '../../inventory/service/inventory.service';

export class CartService {
  constructor(private readonly inventory = new InventoryService()) {}

  private async getOrCreateCart(userId: string) {
    let cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            variant: {
              include: {
                inventory: true,
                product: {
                  include: {
                    images: { orderBy: { sortOrder: 'asc' }, take: 1 },
                    seller: { select: { businessName: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
        include: {
          items: {
            include: {
              variant: {
                include: {
                  inventory: true,
                  product: {
                    include: {
                      images: { orderBy: { sortOrder: 'asc' }, take: 1 },
                      seller: { select: { businessName: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });
    }
    return cart;
  }

  async getCart(userId: string) {
    return this.getOrCreateCart(userId);
  }

  async addItem(userId: string, variantId: string, quantity: number) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { inventory: true },
    });
    if (!variant?.inventory) throw new NotFoundError('Variant not found');

    const cart = await this.getOrCreateCart(userId);
    const existing = cart.items.find((i) => i.variantId === variantId);
    const newQty = (existing?.quantity ?? 0) + quantity;

    const freshInv = await prisma.inventory.findUnique({ where: { variantId } });
    if (!freshInv || freshInv.availableStock < quantity) {
      throw new DomainError('Insufficient stock');
    }

    await this.inventory.reserveStock(variantId, quantity, `cart-${cart.id}`);

    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: newQty },
      });
    } else {
      await prisma.cartItem.create({
        data: { cartId: cart.id, variantId, quantity },
      });
    }

    return this.getOrCreateCart(userId);
  }

  async updateQuantity(userId: string, variantId: string, quantity: number) {
    const cart = await this.getOrCreateCart(userId);
    const item = cart.items.find((i) => i.variantId === variantId);
    if (!item) throw new NotFoundError('Cart item not found');

    const diff = quantity - item.quantity;
    if (diff > 0) {
      await this.inventory.reserveStock(variantId, diff, `cart-${cart.id}`);
    } else if (diff < 0) {
      await this.inventory.releaseStock(variantId, Math.abs(diff), `cart-${cart.id}`);
    }

    await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
    return this.getOrCreateCart(userId);
  }

  async removeItem(userId: string, variantId: string) {
    const cart = await this.getOrCreateCart(userId);
    const item = cart.items.find((i) => i.variantId === variantId);
    if (!item) throw new NotFoundError('Cart item not found');

    await this.inventory.releaseStock(variantId, item.quantity, `cart-${cart.id}`);
    await prisma.cartItem.delete({ where: { id: item.id } });
    return this.getOrCreateCart(userId);
  }

  async clearCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    for (const item of cart.items) {
      await this.inventory.releaseStock(item.variantId, item.quantity, `cart-${cart.id}`);
    }
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.getOrCreateCart(userId);
  }
}
