import type { OrderStatus, Prisma } from '@prisma/client';
import { prisma } from '../../../config/database/prisma.client';

const REVENUE_ORDER_STATUSES: OrderStatus[] = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
const NET_MARGIN_FACTOR = 0.72;

export type SellerAnalyticsPeriod = '7d' | '30d' | '90d' | 'ytd';

function sellerItemRevenue(items: { price: Prisma.Decimal; quantity: number }[]) {
  return items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function analyticsPeriodRange(period: SellerAnalyticsPeriod) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);

  if (period === 'ytd') {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    const priorEnd = new Date(start);
    priorEnd.setMilliseconds(-1);
    const priorStart = new Date(priorEnd.getFullYear(), 0, 1);
    priorStart.setHours(0, 0, 0, 0);
    const days = Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
    return { start, end, priorStart, priorEnd, days };
  }

  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const priorEnd = new Date(start);
  priorEnd.setMilliseconds(-1);
  const priorStart = new Date(priorEnd);
  priorStart.setDate(priorStart.getDate() - (days - 1));
  priorStart.setHours(0, 0, 0, 0);

  return { start, end, priorStart, priorEnd, days };
}

function last7DayRange(end: Date) {
  const chartEnd = new Date(end);
  const chartStart = new Date(chartEnd);
  chartStart.setDate(chartStart.getDate() - 6);
  chartStart.setHours(0, 0, 0, 0);
  return { chartStart, chartEnd };
}

function regionFromAddress(address: unknown): string | null {
  if (!address || typeof address !== 'object') return null;
  const a = address as Record<string, unknown>;
  const country = a.country ?? a.countryCode;
  const state = a.state ?? a.province;
  if (typeof country === 'string' && country.trim()) return country.trim();
  if (typeof state === 'string' && state.trim()) return state.trim();
  return null;
}

export class SellerAnalyticsService {
  private async ordersInRange(sellerId: string, start: Date, end: Date, revenueOnly = false) {
    return prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        items: { some: { sellerId } },
        ...(revenueOnly ? { status: { in: REVENUE_ORDER_STATUSES } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        items: {
          where: { sellerId },
          include: {
            product: {
              include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
            },
          },
        },
      },
    });
  }

  private buildSalesTrend(
    orders: Awaited<ReturnType<SellerAnalyticsService['ordersInRange']>>,
    end: Date,
  ) {
    const { chartStart } = last7DayRange(end);
    const buckets = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(chartStart);
      d.setDate(d.getDate() + i);
      return {
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        grossSales: 0,
        netSales: 0,
      };
    });

    for (const order of orders) {
      if (!REVENUE_ORDER_STATUSES.includes(order.status)) continue;
      const idx = Math.floor(
        (new Date(order.createdAt).setHours(0, 0, 0, 0) - chartStart.getTime()) / 86_400_000,
      );
      if (idx >= 0 && idx < 7) {
        const gross = sellerItemRevenue(order.items);
        buckets[idx].grossSales += gross;
        buckets[idx].netSales += gross * NET_MARGIN_FACTOR;
      }
    }

    const maxGross = Math.max(1, ...buckets.map((b) => b.grossSales));
    const maxNet = Math.max(1, ...buckets.map((b) => b.netSales));

    return buckets.map((b) => ({
      label: b.label,
      grossSales: b.grossSales,
      netSales: b.netSales,
      grossPercent: Math.round((b.grossSales / maxGross) * 100),
      netPercent: Math.round((b.netSales / maxNet) * 100),
    }));
  }

  private aggregateTopProducts(
    orders: Awaited<ReturnType<SellerAnalyticsService['ordersInRange']>>,
    limit = 8,
  ) {
    const byProduct = new Map<
      string,
      { productId: string; name: string; imageUrl: string | null; unitsSold: number; revenue: number }
    >();

    for (const order of orders) {
      if (!REVENUE_ORDER_STATUSES.includes(order.status)) continue;
      for (const item of order.items) {
        const key = item.productId;
        const existing = byProduct.get(key) ?? {
          productId: key,
          name: item.product.name,
          imageUrl: item.product.images[0]?.imageUrl ?? null,
          unitsSold: 0,
          revenue: 0,
        };
        existing.unitsSold += item.quantity;
        existing.revenue += Number(item.price) * item.quantity;
        byProduct.set(key, existing);
      }
    }

    return [...byProduct.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  private computeCustomerInsights(
    currentOrders: Awaited<ReturnType<SellerAnalyticsService['ordersInRange']>>,
    priorOrders: Awaited<ReturnType<SellerAnalyticsService['ordersInRange']>>,
  ) {
    const countByUser = (orders: typeof currentOrders) => {
      const map = new Map<string, number>();
      for (const o of orders) {
        if (!REVENUE_ORDER_STATUSES.includes(o.status)) continue;
        map.set(o.userId, (map.get(o.userId) ?? 0) + 1);
      }
      return map;
    };

    const currentCounts = countByUser(currentOrders);
    const priorCounts = countByUser(priorOrders);

    const uniqueCustomers = currentCounts.size;
    const repeatCustomers = [...currentCounts.values()].filter((c) => c > 1).length;
    const repeatRate = uniqueCustomers === 0 ? 0 : (repeatCustomers / uniqueCustomers) * 100;

    const priorUnique = priorCounts.size;
    const priorRepeat = [...priorCounts.values()].filter((c) => c > 1).length;
    const priorRate = priorUnique === 0 ? 0 : (priorRepeat / priorUnique) * 100;

    const regionCounts = new Map<string, number>();
    for (const o of currentOrders) {
      if (!REVENUE_ORDER_STATUSES.includes(o.status)) continue;
      const region = regionFromAddress(o.shippingAddress) ?? 'Unknown';
      regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
    }
    const topRegion =
      [...regionCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

    return {
      repeatCustomerRate: Math.round(repeatRate * 10) / 10,
      repeatCustomerChangePct: pctChange(repeatRate, priorRate),
      topRegion,
      topChannel: 'Marketplace',
    };
  }

  async getAnalytics(sellerId: string, period: SellerAnalyticsPeriod = '30d') {
    const { start, end, priorStart, priorEnd } = analyticsPeriodRange(period);

    const [currentRevenueOrders, priorRevenueOrders, allCurrentOrders] = await Promise.all([
      this.ordersInRange(sellerId, start, end, true),
      this.ordersInRange(sellerId, priorStart, priorEnd, true),
      this.ordersInRange(sellerId, start, end, false),
    ]);

    const revenue = currentRevenueOrders.reduce((s, o) => s + sellerItemRevenue(o.items), 0);
    const priorRevenue = priorRevenueOrders.reduce((s, o) => s + sellerItemRevenue(o.items), 0);
    const orderCount = currentRevenueOrders.length;
    const priorOrderCount = priorRevenueOrders.length;
    const avgOrderValue = orderCount === 0 ? 0 : revenue / orderCount;
    const priorAov = priorOrderCount === 0 ? 0 : priorRevenue / priorOrderCount;

    const fulfilled = currentRevenueOrders.length;
    const totalAttempts = allCurrentOrders.length;
    const conversionRate = totalAttempts === 0 ? 0 : (fulfilled / totalAttempts) * 100;

    const priorFulfilled = priorRevenueOrders.length;
    const priorAttempts = await prisma.order.count({
      where: {
        createdAt: { gte: priorStart, lte: priorEnd },
        items: { some: { sellerId } },
      },
    });
    const priorConversion =
      priorAttempts === 0 ? 0 : (priorFulfilled / priorAttempts) * 100;

    const salesTrend = this.buildSalesTrend(currentRevenueOrders, end);
    const topProducts = this.aggregateTopProducts(currentRevenueOrders);
    const customerInsights = this.computeCustomerInsights(currentRevenueOrders, priorRevenueOrders);

    const highValueOrders = [...currentRevenueOrders]
      .map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: `${o.user.firstName} ${o.user.lastName}`.trim() || o.user.email,
        amount: sellerItemRevenue(o.items),
        status: o.status,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);

    return {
      period,
      kpis: {
        revenue,
        revenueChangePct: pctChange(revenue, priorRevenue),
        orderCount,
        orderChangePct: pctChange(orderCount, priorOrderCount),
        conversionRate: Math.round(conversionRate * 10) / 10,
        conversionChangePct: pctChange(conversionRate, priorConversion),
        avgOrderValue,
        aovChangePct: pctChange(avgOrderValue, priorAov),
      },
      salesTrend,
      topProducts,
      highValueOrders,
      customerInsights,
    };
  }

  async exportCsv(sellerId: string, period: SellerAnalyticsPeriod = '30d') {
    const data = await this.getAnalytics(sellerId, period);
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;

    const lines = [
      ['Seller Analytics Report', period].map(escape).join(','),
      '',
      ['KPI', 'Value', 'Change %'].join(','),
      ['Total Revenue', data.kpis.revenue.toFixed(2), data.kpis.revenueChangePct.toFixed(1)].join(','),
      ['Total Orders', String(data.kpis.orderCount), data.kpis.orderChangePct.toFixed(1)].join(','),
      ['Conversion Rate', `${data.kpis.conversionRate}%`, data.kpis.conversionChangePct.toFixed(1)].join(','),
      ['Avg Order Value', data.kpis.avgOrderValue.toFixed(2), data.kpis.aovChangePct.toFixed(1)].join(','),
      '',
      ['Top Products', 'Units', 'Revenue'].join(','),
      ...data.topProducts.map((p) =>
        [escape(p.name), String(p.unitsSold), p.revenue.toFixed(2)].join(','),
      ),
      '',
      ['High Value Orders', 'Customer', 'Amount', 'Status'].join(','),
      ...data.highValueOrders.map((o) =>
        [escape(o.orderNumber), escape(o.customerName), o.amount.toFixed(2), escape(o.status)].join(','),
      ),
    ];

    return lines.join('\n');
  }
}
