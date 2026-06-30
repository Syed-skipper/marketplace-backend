import { z } from 'zod';

export const createSavedCardSchema = z.object({
  label: z.string().max(100).optional(),
  brand: z.enum(['VISA', 'MASTERCARD', 'RUPAY', 'AMEX', 'OTHER']),
  last4: z.string().regex(/^\d{4}$/, 'Last 4 digits must be exactly 4 numbers'),
  expMonth: z.coerce.number().int().min(1).max(12),
  expYear: z.coerce.number().int().min(new Date().getFullYear()).max(new Date().getFullYear() + 20),
  cardholderName: z.string().max(120).optional(),
  isDefault: z.boolean().optional(),
});

export const updateSavedCardSchema = z.object({
  label: z.string().max(100).optional(),
  isDefault: z.boolean().optional(),
});

export const claimCouponSchema = z.object({
  code: z.string().min(2).max(50),
});
