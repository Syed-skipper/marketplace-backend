import { z } from 'zod';

export const createPaymentIntentSchema = z.object({
  orderId: z.string().uuid(),
  provider: z.enum(['STRIPE', 'RAZORPAY']),
});

export const verifyRazorpaySchema = z.object({
  orderId: z.string().uuid(),
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});
