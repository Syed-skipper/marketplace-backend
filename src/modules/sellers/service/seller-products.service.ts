import type { Prisma } from '@prisma/client';
import { prisma } from '../../../config/database/prisma.client';
import { parsePagination } from '../../../common/types/pagination.types';

export type SellerProductListFilter = 'all' | 'active' | 'draft' | 'out-of-stock';

export type SellerProductsListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  status?: SellerProductListFilter;
  categoryId?: string;
};

function buildWhere(sellerId: string, query: SellerProductsListQuery): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [{ sellerId }];

  if (query.categoryId) {
    and.push({ categoryId: query.categoryId });
  }

  if (query.search?.trim()) {
    const term = query.search.trim();
    and.push({
      OR: [
        { name: { contains: term, mode: 'insensitive' } },
        { brand: { contains: term, mode: 'insensitive' } },
        { variants: { some: { sku: { contains: term, mode: 'insensitive' } } } },
      ],
    });
  }

  const filter = query.status ?? 'all';
  if (filter === 'active') {
    and.push({
      status: 'ACTIVE',
      variants: { some: { inventory: { availableStock: { gt: 0 } } } },
    });
  } else if (filter === 'draft') {
    and.push({ status: { in: ['DRAFT', 'REJECTED'] } });
  } else if (filter === 'out-of-stock') {
    and.push({
      variants: { none: { inventory: { availableStock: { gt: 0 } } } },
    });
  }

  return and.length === 1 ? and[0] : { AND: and };
}

const productInclude = {
  images: { orderBy: { sortOrder: 'asc' as const }, take: 1 },
  variants: { include: { inventory: true } },
  category: { select: { id: true, name: true, slug: true } },
};

export class SellerProductsService {
  async getStats(sellerId: string) {
    const base = { sellerId };
    const [total, active, drafts, outOfStock] = await Promise.all([
      prisma.product.count({ where: base }),
      prisma.product.count({
        where: {
          ...base,
          status: 'ACTIVE',
          variants: { some: { inventory: { availableStock: { gt: 0 } } } },
        },
      }),
      prisma.product.count({
        where: { ...base, status: { in: ['DRAFT', 'REJECTED'] } },
      }),
      prisma.product.count({
        where: {
          ...base,
          variants: { none: { inventory: { availableStock: { gt: 0 } } } },
        },
      }),
    ]);
    return { total, active, drafts, outOfStock };
  }

  async list(sellerId: string, query: SellerProductsListQuery) {
    const { page, limit, skip } = parsePagination(query);
    const where = buildWhere(sellerId, query);

    const [items, total, stats] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: productInclude,
      }),
      prisma.product.count({ where }),
      this.getStats(sellerId),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
        stats,
      },
    };
  }

  async exportCsv(sellerId: string, query: Omit<SellerProductsListQuery, 'page' | 'limit'>) {
    const where = buildWhere(sellerId, query);
    const items = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10_000,
      include: productInclude,
    });

    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = [
      'Name',
      'SKU',
      'Category',
      'Status',
      'Price',
      'Stock',
      'Created At',
    ].join(',');

    const rows = items.map((p) => {
      const variant = p.variants[0];
      const stock = p.variants.reduce(
        (sum, v) => sum + (v.inventory?.availableStock ?? 0),
        0,
      );
      const price = variant?.discountPrice ?? variant?.price ?? 0;
      return [
        escape(p.name),
        escape(variant?.sku ?? ''),
        escape(p.category?.name ?? ''),
        escape(p.status),
        escape(Number(price).toFixed(2)),
        escape(String(stock)),
        escape(p.createdAt.toISOString()),
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }
}
