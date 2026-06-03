import { prisma } from '../../../config/database/prisma.client';

export class WishlistService {
  private includeProducts = {
    items: { include: { product: { include: { images: { take: 1 } } } } },
  } as const;

  async getOrCreate(userId: string, name = 'Default') {
    let wishlist = await prisma.wishlist.findFirst({
      where: { userId, name },
      include: this.includeProducts,
    });
    if (!wishlist) {
      wishlist = await prisma.wishlist.create({
        data: { userId, name },
        include: this.includeProducts,
      });
    }
    return wishlist;
  }

  async addItem(userId: string, productId: string) {
    const wishlist = await this.getOrCreate(userId);
    await prisma.wishlistItem.upsert({
      where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
      update: {},
      create: { wishlistId: wishlist.id, productId },
    });
    return this.getOrCreate(userId);
  }

  async removeItem(userId: string, productId: string) {
    const wishlist = await this.getOrCreate(userId);
    await prisma.wishlistItem.deleteMany({
      where: { wishlistId: wishlist.id, productId },
    });
    return this.getOrCreate(userId);
  }
}
