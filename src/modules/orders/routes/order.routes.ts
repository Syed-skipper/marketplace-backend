import { Router } from 'express';
import { OrderService } from '../service/order.service';
import { asyncHandler } from '../../../common/utils/async-handler';
import { sendSuccess } from '../../../common/utils/response.util';
import { authenticate, hasPermission } from '../../../common/middlewares/auth.middleware';
import { PERMISSIONS } from '../../../common/constants/permissions';
import { prisma } from '../../../config/database/prisma.client';

const router = Router();
const service = new OrderService();

router.use(authenticate);

router.post('/', hasPermission(PERMISSIONS.ORDER_CREATE), asyncHandler(async (req, res) => {
  const order = await service.createFromCart(req.user!.sub, req.body.shippingAddress);
  sendSuccess(res, order, 'Order created', 201);
}));

router.get('/', hasPermission(PERMISSIONS.ORDER_VIEW), asyncHandler(async (req, res) => {
  const result = await service.listForUser(req.user!.sub, req.query);
  sendSuccess(res, result.items, 'Success', 200, result.meta);
}));

router.get('/seller', hasPermission(PERMISSIONS.ORDER_VIEW), asyncHandler(async (req, res) => {
  const seller = await prisma.seller.findUnique({ where: { userId: req.user!.sub } });
  if (!seller) {
    res.status(403).json({ success: false, message: 'Seller profile required' });
    return;
  }
  const result = await service.listForSeller(seller.id, req.query);
  sendSuccess(res, result.items, 'Success', 200, result.meta);
}));

router.get('/:id', hasPermission(PERMISSIONS.ORDER_VIEW), asyncHandler(async (req, res) => {
  const isAdmin = req.user!.roles.includes('admin');
  const order = await service.getById(req.params.id, isAdmin ? undefined : req.user!.sub);
  sendSuccess(res, order);
}));

router.post('/:id/cancel', hasPermission(PERMISSIONS.ORDER_CANCEL), asyncHandler(async (req, res) => {
  const order = await service.transitionStatus(req.params.id, 'CANCELLED');
  sendSuccess(res, order, 'Order cancelled');
}));

export default router;
