import crypto from 'crypto';
import { ProductRepository } from '../repository/product.repository';
import { NotFoundError, AuthorizationError } from '../../../common/exceptions/errors';
import { generateSlug, appendUniqueSuffix } from '../../../common/utils/slug.util';
import { persistProductImages } from '../../../common/utils/product-image.util';
import { eventBus } from '../../../common/events/event-bus';
import { DomainEventType } from '../../../common/events/domain-events';
import { parsePagination, PaginatedResult } from '../../../common/types/pagination.types';
import { prisma } from '../../../config/database/prisma.client';
import { ProductStatus } from '@prisma/client';

export class ProductService {
  constructor(private readonly repo = new ProductRepository()) {}

  async getFilterOptions() {
    const rows = await prisma.product.findMany({
      where: { status: 'ACTIVE', brand: { not: null } },
      distinct: ['brand'],
      select: { brand: true },
      orderBy: { brand: 'asc' },
    });
    return {
      brands: rows.map((r) => r.brand).filter((b): b is string => Boolean(b?.trim())),
    };
  }

  private async resolveCategoryIds(categoryId?: string): Promise<string[] | undefined> {
    if (!categoryId) return undefined;

    const rows = await prisma.category.findMany({
      where: {
        OR: [
          { id: categoryId },
          { parentId: categoryId },
          { parent: { parentId: categoryId } },
        ],
      },
      select: { id: true },
    });

    return rows.map((row) => row.id);
  }

  async list(query: Record<string, unknown>) {
    const { page, limit, skip, sortOrder, sortBy } = parsePagination(query as { page?: number; limit?: number });
    const inStock = query.inStock as boolean | undefined;
    const onSale = query.onSale as boolean | undefined;
    const categoryIds = await this.resolveCategoryIds(query.categoryId as string | undefined);
    const { items, total } = await this.repo.findMany({
      sellerId: query.sellerId as string | undefined,
      categoryIds,
      status: (query.status as ProductStatus) ?? 'ACTIVE',
      search: query.search as string | undefined,
      brand: query.brand as string | undefined,
      minPrice: query.minPrice != null ? Number(query.minPrice) : undefined,
      maxPrice: query.maxPrice != null ? Number(query.maxPrice) : undefined,
      minRating: query.minRating != null ? Number(query.minRating) : undefined,
      onSale,
      inStock: inStock === undefined ? true : inStock,
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
      slug?: string;
      metaTitle?: string;
      metaDescription?: string;
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
    let slug = data.slug ? generateSlug(data.slug) : generateSlug(data.name);
    const existing = await this.repo.slugExists(slug);
    if (existing) slug = appendUniqueSuffix(slug, crypto.randomUUID());

    const images = await persistProductImages(data.images);

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          sellerId,
          categoryId: data.categoryId,
          name: data.name,
          slug,
          description: data.description,
          metaTitle: data.metaTitle,
          metaDescription: data.metaDescription,
          brand: data.brand,
          status: 'DRAFT',
          images: images
            ? { create: images.map((img, i) => ({ imageUrl: img.imageUrl, sortOrder: img.sortOrder ?? i })) }
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

  async updateStatus(
    id: string,
    status: ProductStatus,
    sellerId: string | null,
    isAdmin: boolean,
  ) {
    const product = await this.repo.findById(id);
    if (!product) throw new NotFoundError('Product not found');

    if (!isAdmin) {
      if (!sellerId || product.sellerId !== sellerId) {
        throw new AuthorizationError('Not authorized to update this product status');
      }
      if (status === 'REJECTED') {
        throw new AuthorizationError('Sellers cannot set REJECTED status');
      }
      if (!['DRAFT', 'INACTIVE', 'ACTIVE'].includes(status)) {
        throw new AuthorizationError('Invalid status for seller');
      }
    }

    return this.repo.updateStatus(id, status);
  }
}
