import type { Prisma } from '@prisma/client';
import { prisma } from '../../../config/database/prisma.client';
import { NotFoundError } from '../../../common/exceptions/errors';
import { parsePagination } from '../../../common/types/pagination.types';
import { InventoryService } from '../../inventory/service/inventory.service';
import { SellerService } from './seller.service';

const LOW_STOCK_THRESHOLD = 5;
const DEFAULT_RESTOCK_QUANTITY = 50;

export type SellerInventoryStockFilter = 'all' | 'low-stock' | 'out-of-stock';

export type SellerInventoryListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  status?: SellerInventoryStockFilter;
};

export type SellerInventoryPeriod = '7' | '30';

const variantInclude = {
  product: {
    select: {
      id: true,
      name: true,
      status: true,
      category: { select: { name: true } },
      images: { orderBy: { sortOrder: 'asc' as const }, take: 1 },
    },
  },
  inventory: true,
} satisfies Prisma.ProductVariantInclude;

function stockStatus(available: number): 'healthy' | 'low-stock' | 'out-of-stock' {
  if (available <= 0) return 'out-of-stock';
  if (available < LOW_STOCK_THRESHOLD) return 'low-stock';
  return 'healthy';
}

function buildVariantWhere(sellerId: string, query: SellerInventoryListQuery): Prisma.ProductVariantWhereInput {
  const and: Prisma.ProductVariantWhereInput[] = [
    { product: { sellerId } },
    { product: { status: { in: ['ACTIVE', 'DRAFT'] } } },
  ];

  const filter = query.status ?? 'all';
  if (filter === 'low-stock') {
    and.push({
      inventory: {
        availableStock: { gt: 0, lt: LOW_STOCK_THRESHOLD },
      },
    });
  } else if (filter === 'out-of-stock') {
    and.push({
      OR: [
        { inventory: { availableStock: 0 } },
        { inventory: null },
      ],
    });
  }

  if (query.search?.trim()) {
    const term = query.search.trim();
    and.push({
      OR: [
        { sku: { contains: term, mode: 'insensitive' } },
        { product: { name: { contains: term, mode: 'insensitive' } } },
        { product: { category: { name: { contains: term, mode: 'insensitive' } } } },
      ],
    });
  }

  return { AND: and };
}

function periodDates(period: SellerInventoryPeriod) {
  const days = period === '7' ? 7 : 30;
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  return { start, end, days };
}

export class SellerInventoryService {
  private readonly sellerService = new SellerService();

  async getStats(sellerId: string) {
    const base: Prisma.ProductVariantWhereInput = {
      product: { sellerId },
    };

    const [totalProducts, variantRows] = await Promise.all([
      prisma.product.count({ where: { sellerId } }),
      prisma.productVariant.findMany({
        where: base,
        select: {
          inventory: { select: { availableStock: true, reservedStock: true } },
        },
      }),
    ]);

    let reservedStock = 0;
    let lowStock = 0;
    let outOfStock = 0;

    for (const row of variantRows) {
      const available = row.inventory?.availableStock ?? 0;
      const reserved = row.inventory?.reservedStock ?? 0;
      reservedStock += reserved;
      const status = stockStatus(available);
      if (status === 'low-stock') lowStock += 1;
      if (status === 'out-of-stock') outOfStock += 1;
    }

    return {
      totalProducts,
      reservedStock,
      lowStock,
      outOfStock,
    };
  }

  async getSummary(sellerId: string, period: SellerInventoryPeriod = '30') {
    const stats = await this.getStats(sellerId);
    const { start, end, days } = periodDates(period);

    const seller = await prisma.seller.findUnique({
      where: { id: sellerId },
      select: { businessName: true },
    });

    const variantIds = await prisma.productVariant.findMany({
      where: { product: { sellerId } },
      select: { id: true },
    });
    const ids = variantIds.map((v) => v.id);

    const transactions =
      ids.length > 0
        ? await prisma.inventoryTransaction.findMany({
            where: {
              variantId: { in: ids },
              createdAt: { gte: start, lte: end },
              type: { in: ['RESTOCK', 'ADJUSTMENT'] },
            },
            select: { quantity: true, createdAt: true },
          })
        : [];

    const buckets = Array.from({ length: days }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return {
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        units: 0,
      };
    });

    for (const tx of transactions) {
      const txDate = new Date(tx.createdAt);
      txDate.setHours(0, 0, 0, 0);
      const diff = Math.floor((txDate.getTime() - start.getTime()) / 86400000);
      if (diff >= 0 && diff < buckets.length) {
        buckets[diff].units += Math.abs(tx.quantity);
      }
    }

    const maxUnits = Math.max(1, ...buckets.map((b) => b.units));
    const chart = buckets.map((b) => ({
      label: b.label,
      units: b.units,
      heightPercent: Math.round((b.units / maxUnits) * 100),
    }));

    const healthyCount = variantIds.length - stats.lowStock - stats.outOfStock;
    const capacityPercent =
      variantIds.length === 0
        ? 0
        : Math.min(100, Math.round((healthyCount / variantIds.length) * 100));

    return {
      period,
      stats,
      chart,
      warehouse: {
        name: seller?.businessName ?? 'Primary Warehouse',
        location: 'Seller fulfillment center',
        capacityPercent,
      },
    };
  }

  async list(sellerId: string, query: SellerInventoryListQuery) {
    const { page, limit, skip } = parsePagination(query);
    const where = buildVariantWhere(sellerId, query);

    const [variants, total, stats] = await Promise.all([
      prisma.productVariant.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ inventory: { availableStock: 'asc' } }, { product: { name: 'asc' } }],
        include: variantInclude,
      }),
      prisma.productVariant.count({ where }),
      this.getStats(sellerId),
    ]);

    const items = variants.map((v) => {
      const available = v.inventory?.availableStock ?? 0;
      const reserved = v.inventory?.reservedStock ?? 0;
      const current = available + reserved;
      const status = stockStatus(available);

      return {
        variantId: v.id,
        productId: v.product.id,
        name: v.product.name,
        category: v.product.category?.name ?? '—',
        sku: v.sku,
        imageUrl: v.product.images[0]?.imageUrl ?? null,
        current,
        reserved,
        available,
        status,
      };
    });

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

  async exportCsv(sellerId: string, query: Omit<SellerInventoryListQuery, 'page' | 'limit'>) {
    const where = buildVariantWhere(sellerId, query);
    const variants = await prisma.productVariant.findMany({
      where,
      orderBy: { product: { name: 'asc' } },
      take: 10_000,
      include: variantInclude,
    });

    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = [
      'Product',
      'Category',
      'SKU',
      'Current',
      'Reserved',
      'Available',
      'Status',
    ].join(',');

    const rows = variants.map((v) => {
      const available = v.inventory?.availableStock ?? 0;
      const reserved = v.inventory?.reservedStock ?? 0;
      const current = available + reserved;
      const status = stockStatus(available);

      return [
        escape(v.product.name),
        escape(v.product.category?.name ?? ''),
        escape(v.sku),
        String(current),
        String(reserved),
        String(available),
        escape(status),
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }

  async restockLowStock(sellerId: string, quantity = DEFAULT_RESTOCK_QUANTITY) {
    const variants = await prisma.productVariant.findMany({
      where: {
        product: { sellerId, status: 'ACTIVE' },
        inventory: { availableStock: { gt: 0, lt: LOW_STOCK_THRESHOLD } },
      },
      select: { id: true },
    });

    const results = [];
    for (const v of variants) {
      const result = await this.sellerService.restockVariant(sellerId, v.id, quantity);
      results.push(result);
    }

    return { updated: results.length, variants: results };
  }

  async restockVariant(sellerId: string, variantId: string, quantity = DEFAULT_RESTOCK_QUANTITY) {
    return this.sellerService.restockVariant(sellerId, variantId, quantity);
  }

  async setAvailableStock(sellerId: string, variantId: string, availableStock: number) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true },
    });
    if (!variant || variant.product.sellerId !== sellerId) {
      throw new NotFoundError('Variant not found');
    }

    const inventoryService = new InventoryService();
    const updated = await inventoryService.updateStock(variantId, availableStock);
    return {
      variantId,
      availableStock: updated.availableStock,
      reservedStock: updated.reservedStock,
    };
  }
}
