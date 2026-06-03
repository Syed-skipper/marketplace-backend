import crypto from 'crypto';
import { ProductRepository } from '../repository/product.repository';
import { NotFoundError, AuthorizationError } from '../../../common/exceptions/errors';
import { generateSlug, appendUniqueSuffix } from '../../../common/utils/slug.util';
import { eventBus } from '../../../common/events/event-bus';
import { DomainEventType } from '../../../common/events/domain-events';
import { parsePagination, PaginatedResult } from '../../../common/types/pagination.types';
import { prisma } from '../../../config/database/prisma.client';
import { ProductStatus } from '@prisma/client';

export class ProductService {
  constructor(private readonly repo = new ProductRepository()) {}

  async list(query: Record<string, unknown>) {
    const { page, limit, skip, sortOrder, sortBy } = parsePagination(query as { page?: number; limit?: number });
    const { items, total } = await this.repo.findMany({
      sellerId: query.sellerId as string | undefined,
      categoryId: query.categoryId as string | undefined,
      status: (query.status as ProductStatus) ?? 'ACTIVE',
      search: query.search as string | undefined,
      brand: query.brand as string | undefined,
      skip,
      take: limit,
      sortBy: sortBy as string | undefined,
      sortOrder,
    });

    const result: PaginatedResult<typeof items[0]> = {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
    return result;
  }

  async getById(id: string) {
    const product = await this.repo.findById(id);
    if (!product) throw new NotFoundError('Product not found');
    return product;
  }

  async create(
    sellerId: string,
    data: {
      categoryId: string;
      name: string;
      description?: string;
      brand?: string;
      images?: { imageUrl: string; sortOrder?: number }[];
      variants: {
        sku: string;
        color?: string;
        size?: string;
        price: number;
        discountPrice?: number;
        stock: number;
      }[];
    },
  ) {
    let slug = generateSlug(data.name);
    const existing = await this.repo.slugExists(slug);
    if (existing) slug = appendUniqueSuffix(slug, crypto.randomUUID());

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          sellerId,
          categoryId: data.categoryId,
          name: data.name,
          slug,
          description: data.description,
          brand: data.brand,
          status: 'DRAFT',
          images: data.images
            ? { create: data.images.map((img, i) => ({ imageUrl: img.imageUrl, sortOrder: img.sortOrder ?? i })) }
            : undefined,
          variants: {
            create: data.variants.map((v) => ({
              sku: v.sku,
              color: v.color,
              size: v.size,
              price: v.price,
              discountPrice: v.discountPrice,
              inventory: {
                create: { availableStock: v.stock, reservedStock: 0 },
              },
            })),
          },
        },
        include: { images: true, variants: { include: { inventory: true } } },
      });
      return created;
    });

    await eventBus.publish({
      type: DomainEventType.PRODUCT_CREATED,
      payload: { productId: product.id, sellerId },
      occurredAt: new Date(),
    });

    return product;
  }

  async update(
    id: string,
    sellerId: string,
    isAdmin: boolean,
    data: Partial<{
      name: string;
      description: string;
      brand: string;
      categoryId: string;
      status: ProductStatus;
    }>,
  ) {
    const product = await this.repo.findById(id);
    if (!product) throw new NotFoundError('Product not found');
    if (!isAdmin && product.sellerId !== sellerId) {
      throw new AuthorizationError('Not authorized to update this product');
    }

    const updated = await this.repo.update(id, data);

    await eventBus.publish({
      type: DomainEventType.PRODUCT_UPDATED,
      payload: { productId: id },
      occurredAt: new Date(),
    });

    return updated;
  }

  async delete(id: string, sellerId: string, isAdmin: boolean) {
    const product = await this.repo.findById(id);
    if (!product) throw new NotFoundError('Product not found');
    if (!isAdmin && product.sellerId !== sellerId) {
      throw new AuthorizationError('Not authorized to delete this product');
    }
    await this.repo.delete(id);
  }

  async updateStatus(id: string, status: ProductStatus, isAdmin: boolean) {
    if (!isAdmin && status !== 'DRAFT' && status !== 'INACTIVE') {
      throw new AuthorizationError('Sellers can only set DRAFT or INACTIVE');
    }
    const product = await this.repo.findById(id);
    if (!product) throw new NotFoundError('Product not found');
    return this.repo.updateStatus(id, status);
  }
}
