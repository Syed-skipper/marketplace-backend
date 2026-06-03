import { Router } from 'express';
import { ProductController } from '../controller/product.controller';
import { asyncHandler } from '../../../common/utils/async-handler';
import { validate } from '../../../common/middlewares/validate.middleware';
import {
  listProductsSchema,
  createProductSchema,
  updateProductSchema,
  updateStatusSchema,
} from '../validator/product.validator';
import { authenticate, hasPermission, optionalAuthenticate } from '../../../common/middlewares/auth.middleware';
import { PERMISSIONS } from '../../../common/constants/permissions';

const router = Router();
const controller = new ProductController();

router.get('/', optionalAuthenticate, validate(listProductsSchema, 'query'), asyncHandler(controller.list));
router.get('/:id', optionalAuthenticate, asyncHandler(controller.getById));
router.post(
  '/',
  authenticate,
  hasPermission(PERMISSIONS.PRODUCT_CREATE),
  validate(createProductSchema),
  asyncHandler(controller.create),
);
router.put(
  '/:id',
  authenticate,
  hasPermission(PERMISSIONS.PRODUCT_UPDATE),
  validate(updateProductSchema),
  asyncHandler(controller.update),
);
router.delete(
  '/:id',
  authenticate,
  hasPermission(PERMISSIONS.PRODUCT_DELETE),
  asyncHandler(controller.delete),
);
router.patch(
  '/:id/status',
  authenticate,
  hasPermission(PERMISSIONS.PRODUCT_UPDATE),
  validate(updateStatusSchema),
  asyncHandler(controller.updateStatus),
);

export default router;
