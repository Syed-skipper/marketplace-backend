import { prisma } from '../../../config/database/prisma.client';
import { Prisma, ProductStatus } from '@prisma/client';

export interface ProductListFilters {
  sellerId?: string;
  categoryId?: string;
  status?: ProductStatus;
  search?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  skip: number;
  take: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class ProductRepository {
  async findMany(filters: ProductListFilters) {
    const where: Prisma.ProductWhereInput = {};

    if (filters.sellerId) where.sellerId = filters.sellerId;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.status) where.status = filters.status;
    if (filters.brand) where.brand = { contains: filters.brand, mode: 'insensitive' };

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { brand: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const variantConditions: Prisma.ProductVariantWhereInput[] = [];
    if (filters.inStock === true) {
      variantConditions.push({ inventory: { availableStock: { gt: 0 } } });
    }
    if (filters.minPrice != null) {
      variantConditions.push({
        OR: [
          { discountPrice: { gte: filters.minPrice } },
          { discountPrice: null, price: { gte: filters.minPrice } },
        ],
      });
    }
    if (filters.maxPrice != null) {
      variantConditions.push({
        OR: [
          { discountPrice: { lte: filters.maxPrice } },
          { discountPrice: null, price: { lte: filters.maxPrice } },
        ],
      });
    }
    if (variantConditions.length > 0) {
      where.variants = { some: { AND: variantConditions } };
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput = {};
    if (filters.sortBy === 'name') orderBy.name = filters.sortOrder ?? 'asc';
    else if (filters.sortBy === 'price') {
      orderBy.variants = { _min: { price: filters.sortOrder ?? 'asc' } };
    } else orderBy.createdAt = filters.sortOrder ?? 'desc';

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: filters.skip,
        take: filters.take,
        orderBy,
        include: {
          images: { orderBy: { sortOrder: 'asc' }, take: 1 },
          variants: { include: { inventory: true } },
          category: { select: { id: true, name: true, slug: true } },
          seller: { select: { id: true, businessName: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return { items, total };
  }

  findById(id: string) {
    return prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        variants: { include: { inventory: true } },
        category: true,
        seller: { select: { id: true, businessName: true, status: true } },
        reviews: { take: 10, orderBy: { createdAt: 'desc' } },
      },
    });
  }

  findBySlug(slug: string) {
    return prisma.product.findUnique({
      where: { slug },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        variants: { include: { inventory: true } },
        category: true,
        seller: true,
      },
    });
  }

  create(data: Prisma.ProductCreateInput) {
    return prisma.product.create({
      data,
      include: { images: true, variants: true },
    });
  }

  update(id: string, data: Prisma.ProductUpdateInput) {
    return prisma.product.update({ where: { id }, data, include: { images: true, variants: true } });
  }

  delete(id: string) {
    return prisma.product.delete({ where: { id } });
  }

  updateStatus(id: string, status: ProductStatus) {
    return prisma.product.update({ where: { id }, data: { status } });
  }

  slugExists(slug: string, excludeId?: string) {
    return prisma.product.findFirst({
      where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    });
  }
}
