import { Router } from 'express';
import { WishlistService } from '../service/wishlist.service';
import { asyncHandler } from '../../../common/utils/async-handler';
import { sendSuccess } from '../../../common/utils/response.util';
import { authenticate } from '../../../common/middlewares/auth.middleware';

const router = Router();
const service = new WishlistService();

router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  sendSuccess(res, await service.getOrCreate(req.user!.sub));
}));

router.post('/items', asyncHandler(async (req, res) => {
  sendSuccess(res, await service.addItem(req.user!.sub, req.body.productId));
}));

router.delete('/items/:productId', asyncHandler(async (req, res) => {
  sendSuccess(res, await service.removeItem(req.user!.sub, req.params.productId));
}));

export default router;
