import { Router } from 'express';
import { AdminService } from '../service/admin.service';
import { asyncHandler } from '../../../common/utils/async-handler';
import { sendSuccess } from '../../../common/utils/response.util';
import { authenticate, hasPermission } from '../../../common/middlewares/auth.middleware';
import { validate } from '../../../common/middlewares/validate.middleware';
import { PERMISSIONS } from '../../../common/constants/permissions';
import { createAdminUserSchema } from '../validator/admin.validator';

const router = Router();
const service = new AdminService();

router.use(authenticate, hasPermission(PERMISSIONS.ADMIN_DASHBOARD));

router.get('/dashboard', asyncHandler(async (_req, res) => {
  sendSuccess(res, await service.getDashboard());
}));

router.get('/orders', hasPermission(PERMISSIONS.ORDER_VIEW), asyncHandler(async (req, res) => {
  const result = await service.listOrders(Number(req.query.page), Number(req.query.limit));
  sendSuccess(res, result.items, 'Success', 200, { total: result.total });
}));

router.get('/users', hasPermission(PERMISSIONS.ADMIN_USERS), asyncHandler(async (req, res) => {
  const result = await service.listUsers({
    page: Number(req.query.page) || undefined,
    limit: Number(req.query.limit) || undefined,
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
    role: typeof req.query.role === 'string' ? req.query.role : undefined,
    status: typeof req.query.status === 'string' ? req.query.status : undefined,
  });
  sendSuccess(res, result.items, 'Success', 200, {
    ...result.meta,
    summary: result.summary,
  });
}));

router.post(
  '/users',
  hasPermission(PERMISSIONS.ADMIN_USERS),
  validate(createAdminUserSchema),
  asyncHandler(async (req, res) => {
    const user = await service.createUser(req.body, req.user!.sub);
    sendSuccess(res, user, 'User created', 201);
  }),
);

router.get('/users/:id', hasPermission(PERMISSIONS.ADMIN_USERS), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.getUserById(req.params.id));
}));

router.get('/payments', hasPermission(PERMISSIONS.PAYMENT_VIEW), asyncHandler(async (req, res) => {
  const result = await service.listPayments(Number(req.query.page), Number(req.query.limit));
  sendSuccess(res, result.items, 'Success', 200, { total: result.total });
}));

router.get('/audit-logs', hasPermission(PERMISSIONS.ADMIN_AUDIT), asyncHandler(async (req, res) => {
  const result = await service.getAuditLogs(Number(req.query.page), Number(req.query.limit));
  sendSuccess(res, result.items, 'Success', 200, { total: result.total });
}));

export default router;
