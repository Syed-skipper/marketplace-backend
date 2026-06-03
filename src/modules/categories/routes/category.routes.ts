import { Router } from 'express';
import { CategoryService } from '../service/category.service';
import { asyncHandler } from '../../../common/utils/async-handler';
import { sendSuccess } from '../../../common/utils/response.util';
import { authenticate, hasPermission } from '../../../common/middlewares/auth.middleware';

const router = Router();
const service = new CategoryService();

router.get('/tree', asyncHandler(async (_req, res) => {
  const tree = await service.getTree();
  sendSuccess(res, tree);
}));

router.post('/', authenticate, hasPermission('category:create'), asyncHandler(async (req, res) => {
  const cat = await service.create(req.body);
  sendSuccess(res, cat, 'Category created', 201);
}));

router.put('/:id', authenticate, hasPermission('category:update'), asyncHandler(async (req, res) => {
  const cat = await service.update(req.params.id, req.body);
  sendSuccess(res, cat);
}));

router.delete('/:id', authenticate, hasPermission('category:delete'), asyncHandler(async (req, res) => {
  await service.delete(req.params.id);
  sendSuccess(res, null, 'Category deleted');
}));

export default router;
