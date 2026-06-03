import { Router } from 'express';
import { AdminService } from '../service/admin.service';
import { asyncHandler } from '../../../common/utils/async-handler';
import { sendSuccess } from '../../../common/utils/response.util';
import { authenticate, hasPermission } from '../../../common/middlewares/auth.middleware';
import { PERMISSIONS } from '../../../common/constants/permissions';

const router = Router();
const service = new AdminService();

router.use(authenticate, hasPermission(PERMISSIONS.ADMIN_DASHBOARD));

router.get('/dashboard', asyncHandler(async (_req, res) => {
  sendSuccess(res, await service.getDashboard());
}));

router.get('/users', hasPermission(PERMISSIONS.ADMIN_USERS), asyncHandler(async (req, res) => {
  const result = await service.listUsers(Number(req.query.page), Number(req.query.limit));
  sendSuccess(res, result.items, 'Success', 200, { total: result.total });
}));

router.get('/audit-logs', hasPermission(PERMISSIONS.ADMIN_AUDIT), asyncHandler(async (req, res) => {
  const result = await service.getAuditLogs(Number(req.query.page), Number(req.query.limit));
  sendSuccess(res, result.items, 'Success', 200, { total: result.total });
}));

export default router;
