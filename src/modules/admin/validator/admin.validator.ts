import { z } from 'zod';

export const createAdminUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(20).optional().nullable(),
  role: z.enum(['admin', 'seller', 'customer']),
  status: z.enum(['ACTIVE', 'PENDING_VERIFICATION', 'SUSPENDED', 'INACTIVE']).optional(),
});

export const updateAdminUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'INACTIVE', 'PENDING_VERIFICATION']),
});

export const listSellerApplicationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().max(200).optional(),
  status: z.enum(['all', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']).optional(),
  appliedWithin: z.enum(['all', '7d', '30d', '90d']).optional(),
});

export const listProductModerationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().max(200).optional(),
  status: z.enum(['all', 'queue', 'DRAFT', 'ACTIVE', 'INACTIVE', 'REJECTED']).optional(),
  categoryId: z.string().max(36).optional(),
});

export const moderateProductSchema = z.object({
  action: z.enum(['approve', 'reject', 'request_fix']),
  notes: z.string().max(2000).optional(),
});
