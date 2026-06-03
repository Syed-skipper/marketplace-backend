import { Router } from 'express';
import { CartService } from '../service/cart.service';
import { asyncHandler } from '../../../common/utils/async-handler';
import { sendSuccess } from '../../../common/utils/response.util';
import { authenticate } from '../../../common/middlewares/auth.middleware';

const router = Router();
const service = new CartService();

router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const cart = await service.getCart(req.user!.sub);
  sendSuccess(res, cart);
}));

router.post('/items', asyncHandler(async (req, res) => {
  const cart = await service.addItem(req.user!.sub, req.body.variantId, req.body.quantity);
  sendSuccess(res, cart, 'Item added');
}));

router.patch('/items/:variantId', asyncHandler(async (req, res) => {
  const cart = await service.updateQuantity(req.user!.sub, req.params.variantId, req.body.quantity);
  sendSuccess(res, cart);
}));

router.delete('/items/:variantId', asyncHandler(async (req, res) => {
  const cart = await service.removeItem(req.user!.sub, req.params.variantId);
  sendSuccess(res, cart);
}));

router.delete('/', asyncHandler(async (req, res) => {
  const cart = await service.clearCart(req.user!.sub);
  sendSuccess(res, cart, 'Cart cleared');
}));

export default router;
