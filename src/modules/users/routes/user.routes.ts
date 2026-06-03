import { Router } from 'express';
import { UserService } from '../service/user.service';
import { asyncHandler } from '../../../common/utils/async-handler';
import { sendSuccess } from '../../../common/utils/response.util';
import { authenticate } from '../../../common/middlewares/auth.middleware';
import { validate } from '../../../common/middlewares/validate.middleware';
import { addressBodySchema, updateProfileSchema } from '../validator/user.validator';

const router = Router();
const service = new UserService();

router.use(authenticate);

router.get('/me', asyncHandler(async (req, res) => {
  sendSuccess(res, await service.getMe(req.user!.sub));
}));

router.patch('/me', validate(updateProfileSchema), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.updateProfile(req.user!.sub, req.body));
}));

router.get('/me/addresses', asyncHandler(async (req, res) => {
  sendSuccess(res, await service.listAddresses(req.user!.sub));
}));

router.get('/me/addresses/:id', asyncHandler(async (req, res) => {
  sendSuccess(res, await service.getAddress(req.user!.sub, req.params.id));
}));

router.post('/me/addresses', validate(addressBodySchema), asyncHandler(async (req, res) => {
  const address = await service.createAddress(req.user!.sub, req.body);
  sendSuccess(res, address, 'Address created', 201);
}));

router.patch('/me/addresses/:id', validate(addressBodySchema.partial()), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.updateAddress(req.user!.sub, req.params.id, req.body));
}));

router.delete('/me/addresses/:id', asyncHandler(async (req, res) => {
  await service.deleteAddress(req.user!.sub, req.params.id);
  sendSuccess(res, null, 'Address deleted');
}));

export default router;
