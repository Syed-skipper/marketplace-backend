import { prisma } from '../../../config/database/prisma.client';
import { ConflictError, NotFoundError, DomainError } from '../../../common/exceptions/errors';

export class ReviewService {
  async create(userId: string, data: { productId: string; rating: number; comment?: string }) {
    const existing = await prisma.review.findUnique({
      where: { productId_userId: { productId: data.productId, userId } },
    });
    if (existing) throw new ConflictError('You have already reviewed this product');

    const orderItem = await prisma.orderItem.findFirst({
      where: {
        productId: data.productId,
        order: { userId, status: 'DELIVERED' },
      },
    });

    const review = await prisma.review.create({
      data: {
        productId: data.productId,
        userId,
        rating: data.rating,
        comment: data.comment,
        isVerifiedPurchase: !!orderItem,
        orderId: orderItem?.orderId,
      },
    });

    await this.updateProductRating(data.productId);
    return review;
  }

  private async updateProductRating(productId: string) {
    const agg = await prisma.review.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: true,
    });

    await prisma.product.update({
      where: { id: productId },
      data: {
        avgRating: agg._avg.rating ?? 0,
        reviewCount: agg._count,
      },
    });
  }

  async update(reviewId: string, userId: string, data: { rating?: number; comment?: string }) {
    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review || review.userId !== userId) throw new NotFoundError('Review not found');

    const updated = await prisma.review.update({ where: { id: reviewId }, data });
    await this.updateProductRating(review.productId);
    return updated;
  }

  async delete(reviewId: string, userId: string, isAdmin: boolean) {
    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundError('Review not found');
    if (!isAdmin && review.userId !== userId) throw new DomainError('Not authorized');

    await prisma.review.delete({ where: { id: reviewId } });
    await this.updateProductRating(review.productId);
  }
}
