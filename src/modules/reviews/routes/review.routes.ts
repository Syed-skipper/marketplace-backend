import { Router } from 'express';
import { ReviewService } from '../service/review.service';
import { asyncHandler } from '../../../common/utils/async-handler';
import { sendSuccess } from '../../../common/utils/response.util';
import { authenticate } from '../../../common/middlewares/auth.middleware';
import { validate } from '../../../common/middlewares/validate.middleware';
import { createReviewSchema, updateReviewSchema } from '../validator/review.validator';

const router = Router();
const service = new ReviewService();

router.post('/', authenticate, validate(createReviewSchema), asyncHandler(async (req, res) => {
  const review = await service.create(req.user!.sub, req.body);
  sendSuccess(res, review, 'Review created', 201);
}));

router.put('/:id', authenticate, validate(updateReviewSchema), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.update(req.params.id, req.user!.sub, req.body));
}));

router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const isAdmin = req.user!.roles.includes('admin');
  await service.delete(req.params.id, req.user!.sub, isAdmin);
  sendSuccess(res, null, 'Review deleted');
}));

export default router;
