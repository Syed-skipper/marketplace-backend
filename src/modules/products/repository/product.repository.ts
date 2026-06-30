import { prisma } from '../../../config/database/prisma.client';
import { Prisma, ProductStatus } from '@prisma/client';

export interface ProductListFilters {
  sellerId?: string;
  categoryIds?: string[];
  status?: ProductStatus;
  search?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  onSale?: boolean;
  inStock?: boolean;
  skip: number;
  take: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

const productListInclude = {
  images: { orderBy: { sortOrder: 'asc' as const }, take: 1 },
  variants: { include: { inventory: true } },
  category: { select: { id: true, name: true, slug: true } },
  seller: { select: { id: true, businessName: true } },
};

export class ProductRepository {
  private buildWhere(filters: ProductListFilters): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = {};

    if (filters.sellerId) where.sellerId = filters.sellerId;
    if (filters.categoryIds?.length) where.categoryId = { in: filters.categoryIds };
    if (filters.status) where.status = filters.status;
    if (filters.brand) where.brand = { contains: filters.brand, mode: 'insensitive' };
    if (filters.minRating != null) where.avgRating = { gte: filters.minRating };

    const variantConditions: Prisma.ProductVariantWhereInput[] = [];
    if (filters.inStock === true) {
      variantConditions.push({ inventory: { availableStock: { gt: 0 } } });
    }
    if (filters.onSale === true) {
      variantConditions.push({ discountPrice: { not: null } });
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

    return where;
  }

  private buildOrderBy(
    filters: ProductListFilters,
  ): Prisma.ProductOrderByWithRelationInput {
    if (filters.sortBy === 'name') return { name: filters.sortOrder ?? 'asc' };
    if (filters.sortBy === 'avgRating') return { avgRating: filters.sortOrder ?? 'desc' };
    if (filters.sortBy === 'reviewCount') return { reviewCount: filters.sortOrder ?? 'desc' };
    return { createdAt: filters.sortOrder ?? 'desc' };
  }

  private async findManySortedByPrice(
    where: Prisma.ProductWhereInput,
    filters: ProductListFilters,
  ) {
    const matching = await prisma.product.findMany({ where, select: { id: true } });
    const total = matching.length;
    if (total === 0) return { items: [], total };

    const ids = matching.map((product) => product.id);
    const sortDir = filters.sortOrder === 'desc' ? 'DESC' : 'ASC';

    const variantSource =
      filters.inStock === true
        ? Prisma.sql`
            FROM product_variants pv
            INNER JOIN inventory inv
              ON inv.variant_id = pv.id AND inv.available_stock > 0
          `
        : Prisma.sql`FROM product_variants pv`;

    const orderedRows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT p.id
      FROM products p
      INNER JOIN (
        SELECT pv.product_id, MIN(COALESCE(pv.discount_price, pv.price)) AS min_price
        ${variantSource}
        WHERE pv.product_id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
        GROUP BY pv.product_id
      ) prices ON prices.product_id = p.id
      ORDER BY prices.min_price ${Prisma.raw(sortDir)}
      OFFSET ${filters.skip}
      LIMIT ${filters.take}
    `;

    const orderedIds = orderedRows.map((row) => row.id);
    if (orderedIds.length === 0) return { items: [], total };

    const items = await prisma.product.findMany({
      where: { id: { in: orderedIds } },
      include: productListInclude,
    });

    const orderIndex = new Map(orderedIds.map((id, index) => [id, index]));
    items.sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0));

    return { items, total };
  }

  async findMany(filters: ProductListFilters) {
    const where = await this.buildWhereWithSearch(filters);

    if (filters.sortBy === 'price') {
      return this.findManySortedByPrice(where, filters);
    }

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: filters.skip,
        take: filters.take,
        orderBy: this.buildOrderBy(filters),
        include: productListInclude,
      }),
      prisma.product.count({ where }),
    ]);

    return { items, total };
  }

  private async buildWhereWithSearch(filters: ProductListFilters): Promise<Prisma.ProductWhereInput> {
    const where = this.buildWhere(filters);

    if (filters.search) {
      const term = filters.search.trim();
      const ftsMatches = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM products
        WHERE status = ${filters.status ?? 'ACTIVE'}::"ProductStatus"
          AND search_vector @@ plainto_tsquery('english', ${term})
        ORDER BY ts_rank(search_vector, plainto_tsquery('english', ${term})) DESC
        LIMIT 500
      `.catch(() => []);

      if (ftsMatches.length > 0) {
        where.id = { in: ftsMatches.map((row) => row.id) };
      } else {
        where.OR = [
          { name: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { brand: { contains: term, mode: 'insensitive' } },
        ];
      }
    }

    return where;
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
