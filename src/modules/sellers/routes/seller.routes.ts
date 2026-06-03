import { Router } from 'express';
import { SellerService } from '../service/seller.service';
import { asyncHandler } from '../../../common/utils/async-handler';
import { sendSuccess } from '../../../common/utils/response.util';
import { authenticate, hasPermission } from '../../../common/middlewares/auth.middleware';
import { PERMISSIONS } from '../../../common/constants/permissions';

const router = Router();
const service = new SellerService();

router.post('/register', authenticate, hasPermission(PERMISSIONS.SELLER_CREATE), asyncHandler(async (req, res) => {
  const seller = await service.register(req.user!.sub, req.body);
  sendSuccess(res, seller, 'Seller registration submitted', 201);
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const seller = await service.getByUserId(req.user!.sub);
  sendSuccess(res, seller);
}));

router.get('/pending', authenticate, hasPermission(PERMISSIONS.SELLER_APPROVE), asyncHandler(async (req, res) => {
  const result = await service.listPending(Number(req.query.page), Number(req.query.limit));
  sendSuccess(res, result.items, 'Success', 200, { total: result.total });
}));

router.post('/:id/approve', authenticate, hasPermission(PERMISSIONS.SELLER_APPROVE), asyncHandler(async (req, res) => {
  const seller = await service.approve(req.params.id, req.user!.sub);
  sendSuccess(res, seller, 'Seller approved');
}));

router.post('/:id/reject', authenticate, hasPermission(PERMISSIONS.SELLER_APPROVE), asyncHandler(async (req, res) => {
  const seller = await service.reject(req.params.id, req.body.note ?? 'Rejected');
  sendSuccess(res, seller, 'Seller rejected');
}));

export default router;
