import { Router } from 'express';
import { InventoryService } from '../service/inventory.service';
import { asyncHandler } from '../../../common/utils/async-handler';
import { sendSuccess } from '../../../common/utils/response.util';
import { authenticate, hasPermission } from '../../../common/middlewares/auth.middleware';
import { PERMISSIONS } from '../../../common/constants/permissions';

const router = Router();
const service = new InventoryService();

router.patch('/:variantId/stock', authenticate, hasPermission(PERMISSIONS.INVENTORY_UPDATE), asyncHandler(async (req, res) => {
  const inv = await service.updateStock(req.params.variantId, req.body.availableStock);
  sendSuccess(res, inv);
}));

router.get('/:variantId/history', authenticate, hasPermission(PERMISSIONS.INVENTORY_VIEW), asyncHandler(async (req, res) => {
  const history = await service.getHistory(req.params.variantId, Number(req.query.page), Number(req.query.limit));
  sendSuccess(res, history.items, 'Success', 200, { total: history.total });
}));

export default router;
