import { z } from 'zod';

export const sellerDashboardQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d']).default('30d'),
});

export const restockVariantSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(10_000).optional().default(50),
});

export const listSellerProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().max(200).optional(),
  status: z.enum(['all', 'active', 'draft', 'out-of-stock']).default('all'),
  categoryId: z.string().uuid().optional(),
});

export const listSellerOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().max(200).optional(),
  status: z
    .enum(['all', 'pending', 'packed', 'shipped', 'delivered', 'cancelled'])
    .default('all'),
});

export const updateSellerOrderStatusSchema = z.object({
  status: z.enum(['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
});

export const sellerInventoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().max(200).optional(),
  status: z.enum(['all', 'low-stock', 'out-of-stock']).default('all'),
});

export const sellerInventorySummaryQuerySchema = z.object({
  period: z.enum(['7', '30']).default('30'),
});

export const updateVariantStockSchema = z.object({
  availableStock: z.coerce.number().int().min(0).max(1_000_000),
});

export const restockVariantBodySchema = z.object({
  quantity: z.coerce.number().int().min(1).max(10_000).optional().default(50),
});

export const sellerAnalyticsQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d', 'ytd']).default('30d'),
});
