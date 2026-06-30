import { Router } from 'express';
import { WalletService } from '../service/wallet.service';
import { asyncHandler } from '../../../common/utils/async-handler';
import { sendSuccess } from '../../../common/utils/response.util';
import { authenticate } from '../../../common/middlewares/auth.middleware';
import { validate } from '../../../common/middlewares/validate.middleware';
import {
  claimCouponSchema,
  createSavedCardSchema,
  updateSavedCardSchema,
} from '../validator/wallet.validator';

const router = Router();
const service = new WalletService();

router.use(authenticate);

router.get('/saved-cards', asyncHandler(async (req, res) => {
  sendSuccess(res, await service.listSavedCards(req.user!.sub));
}));

router.post('/saved-cards', validate(createSavedCardSchema), asyncHandler(async (req, res) => {
  const card = await service.createSavedCard(req.user!.sub, req.body);
  sendSuccess(res, card, 'Card saved', 201);
}));

router.patch('/saved-cards/:id', validate(updateSavedCardSchema), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.updateSavedCard(req.user!.sub, req.params.id, req.body));
}));

router.delete('/saved-cards/:id', asyncHandler(async (req, res) => {
  await service.deleteSavedCard(req.user!.sub, req.params.id);
  sendSuccess(res, null, 'Card removed');
}));

router.get('/rewards', asyncHandler(async (req, res) => {
  sendSuccess(res, await service.getRewards(req.user!.sub));
}));

router.get('/coupons', asyncHandler(async (req, res) => {
  sendSuccess(res, await service.listUserCoupons(req.user!.sub));
}));

router.get('/coupons/available', asyncHandler(async (req, res) => {
  sendSuccess(res, await service.listAvailableCoupons(req.user!.sub));
}));

router.post('/coupons/claim', validate(claimCouponSchema), asyncHandler(async (req, res) => {
  const coupon = await service.claimCoupon(req.user!.sub, req.body.code);
  sendSuccess(res, coupon, 'Coupon claimed', 201);
}));

export default router;
