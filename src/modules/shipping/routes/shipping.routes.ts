import { Router } from 'express';
import { ShippingService } from '../service/shipping.service';
import { asyncHandler } from '../../../common/utils/async-handler';
import { sendSuccess } from '../../../common/utils/response.util';
import { authenticate, hasPermission } from '../../../common/middlewares/auth.middleware';

const router = Router();
const service = new ShippingService();

router.post('/', authenticate, hasPermission('order:update'), asyncHandler(async (req, res) => {
  const shipment = await service.createShipment(req.body.orderId, req.body.carrier);
  sendSuccess(res, shipment, 'Shipment created', 201);
}));

router.get('/track/:trackingNumber', asyncHandler(async (req, res) => {
  sendSuccess(res, await service.track(req.params.trackingNumber));
}));

router.patch('/:id/status', authenticate, hasPermission('order:update'), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.updateStatus(req.params.id, req.body.status));
}));

export default router;
