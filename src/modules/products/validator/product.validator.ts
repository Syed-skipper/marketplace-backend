import { z } from 'zod';

export const listProductsSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sortBy: z.enum(['name', 'price', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  sellerId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE', 'REJECTED']).optional(),
  search: z.string().max(200).optional(),
  brand: z.string().max(100).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  inStock: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

const imageUrlSchema = z
  .string()
  .min(1)
  .max(2_000_000)
  .refine((v) => v.startsWith('http') || v.startsWith('data:image/'), {
    message: 'Image must be a valid URL or uploaded image',
  });

export const createProductSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(10000).optional(),
  brand: z.string().max(100).optional(),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  metaTitle: z.string().min(1).max(70).optional(),
  metaDescription: z.string().min(1).max(320).optional(),
  images: z
    .array(z.object({ imageUrl: imageUrlSchema, sortOrder: z.number().int().optional() }))
    .optional(),
  variants: z
    .array(
      z.object({
        sku: z.string().min(1).max(100),
        color: z.string().max(50).optional(),
        size: z.string().max(50).optional(),
        price: z.number().positive(),
        discountPrice: z.number().positive().optional(),
        stock: z.number().int().nonnegative(),
      }),
    )
    .min(1),
});

export const updateProductSchema = createProductSchema.partial().omit({ variants: true });

export const updateStatusSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE', 'REJECTED']),
});
