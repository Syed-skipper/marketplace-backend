import { Router, raw } from 'express';
import { PaymentService } from '../service/payment.service';
import { asyncHandler } from '../../../common/utils/async-handler';
import { sendSuccess } from '../../../common/utils/response.util';
import { authenticate, hasPermission } from '../../../common/middlewares/auth.middleware';
import { PERMISSIONS } from '../../../common/constants/permissions';
import { validate } from '../../../common/middlewares/validate.middleware';
import {
  createPaymentIntentSchema,
  verifyRazorpaySchema,
} from '../validator/payment.validator';

const router = Router();
const service = new PaymentService();

router.get(
  '/razorpay/config',
  authenticate,
  asyncHandler(async (_req, res) => {
    sendSuccess(res, service.getRazorpayPublicConfig());
  }),
);

router.post(
  '/razorpay/verify',
  authenticate,
  hasPermission(PERMISSIONS.PAYMENT_PROCESS),
  validate(verifyRazorpaySchema),
  asyncHandler(async (req, res) => {
    const result = await service.verifyRazorpayCheckout(req.user!.sub, req.body);
    sendSuccess(res, result, 'Payment verified');
  }),
);

router.post(
  '/intent',
  authenticate,
  hasPermission(PERMISSIONS.PAYMENT_PROCESS),
  validate(createPaymentIntentSchema),
  asyncHandler(async (req, res) => {
    const result = await service.createPaymentIntent(req.body.orderId, req.body.provider);
    sendSuccess(res, result, 'Payment intent created', 201);
  }),
);

router.post(
  '/:id/refund',
  authenticate,
  hasPermission(PERMISSIONS.PAYMENT_PROCESS),
  asyncHandler(async (req, res) => {
    const payment = await service.refund(req.params.id, req.body.amount);
    sendSuccess(res, payment, 'Refund initiated');
  }),
);

router.post(
  '/webhooks/stripe',
  raw({ type: 'application/json' }),
  asyncHandler(async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    await service.handleStripeWebhook(req.body as Buffer, sig);
    sendSuccess(res, { received: true });
  }),
);

router.post('/webhooks/razorpay', asyncHandler(async (req, res) => {
  const sig = req.headers['x-razorpay-signature'] as string;
  await service.handleRazorpayWebhook(req.body, sig);
  sendSuccess(res, { received: true });
}));

export default router;
