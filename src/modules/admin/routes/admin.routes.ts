import { Router } from 'express';
import { AdminService } from '../service/admin.service';
import { asyncHandler } from '../../../common/utils/async-handler';
import { sendSuccess } from '../../../common/utils/response.util';
import { authenticate, hasPermission } from '../../../common/middlewares/auth.middleware';
import { validate } from '../../../common/middlewares/validate.middleware';
import { PERMISSIONS } from '../../../common/constants/permissions';
import {
  createAdminUserSchema,
  listProductModerationQuerySchema,
  listSellerApplicationsQuerySchema,
  moderateProductSchema,
  updateAdminUserStatusSchema,
} from '../validator/admin.validator';

const router = Router();
const service = new AdminService();

router.use(authenticate, hasPermission(PERMISSIONS.ADMIN_DASHBOARD));

router.get('/dashboard', asyncHandler(async (_req, res) => {
  sendSuccess(res, await service.getDashboard());
}));

router.get('/orders', hasPermission(PERMISSIONS.ORDER_VIEW), asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const result = await service.listOrders(page, limit);
  const totalPages = Math.max(1, Math.ceil(result.total / limit));
  sendSuccess(res, result.items, 'Success', 200, {
    total: result.total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  });
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

router.post(
  '/users/:id/seller-profile',
  hasPermission(PERMISSIONS.SELLER_APPROVE),
  asyncHandler(async (req, res) => {
    const seller = await service.ensureSellerProfile(req.params.id, req.user!.sub);
    sendSuccess(res, seller, 'Seller application created', 201);
  }),
);

router.patch(
  '/users/:id',
  hasPermission(PERMISSIONS.ADMIN_USERS),
  validate(updateAdminUserStatusSchema),
  asyncHandler(async (req, res) => {
    const user = await service.updateUserStatus(
      req.params.id,
      req.body.status,
      req.user!.sub,
    );
    sendSuccess(res, user, 'User status updated');
  }),
);

router.post(
  '/users/:id/verify-email',
  hasPermission(PERMISSIONS.ADMIN_USERS),
  asyncHandler(async (req, res) => {
    const user = await service.verifyUserEmail(req.params.id, req.user!.sub);
    sendSuccess(res, user, 'Email marked as verified');
  }),
);

router.delete(
  '/users/:id',
  hasPermission(PERMISSIONS.ADMIN_USERS),
  asyncHandler(async (req, res) => {
    const result = await service.deleteUser(req.params.id, req.user!.sub);
    sendSuccess(
      res,
      result.user,
      result.deactivated ? 'User deactivated (has order history)' : 'User deleted',
    );
  }),
);

router.get('/payments', hasPermission(PERMISSIONS.PAYMENT_VIEW), asyncHandler(async (req, res) => {
  const result = await service.listPayments(Number(req.query.page), Number(req.query.limit));
  sendSuccess(res, result.items, 'Success', 200, { total: result.total });
}));

router.get(
  '/analytics/orders',
  hasPermission(PERMISSIONS.ORDER_VIEW),
  asyncHandler(async (req, res) => {
    const period = req.query.period === '7d' || req.query.period === '90d' ? req.query.period : '30d';
    sendSuccess(res, await service.getOrderAnalytics(period));
  }),
);

router.get('/audit-logs', hasPermission(PERMISSIONS.ADMIN_AUDIT), asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const result = await service.getAuditLogs(page, limit, search);
  const totalPages = Math.max(1, Math.ceil(result.total / limit));
  sendSuccess(res, result.items, 'Success', 200, {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages,
    hasNextPage: result.page < totalPages,
    hasPrevPage: result.page > 1,
  });
}));

router.get(
  '/seller-applications/filters',
  hasPermission(PERMISSIONS.SELLER_APPROVE),
  asyncHandler(async (_req, res) => {
    sendSuccess(res, service.getSellerApplicationFilters());
  }),
);

router.get(
  '/seller-applications/export',
  hasPermission(PERMISSIONS.SELLER_APPROVE),
  validate(listSellerApplicationsQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const csv = await service.exportSellerApplicationsCsv(req.query as {
      search?: string;
      status?: string;
      appliedWithin?: string;
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="seller-applications.csv"');
    res.status(200).send(csv);
  }),
);

router.get(
  '/seller-applications',
  hasPermission(PERMISSIONS.SELLER_APPROVE),
  validate(listSellerApplicationsQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await service.listSellerApplications(req.query as {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      appliedWithin?: string;
    });
    sendSuccess(res, result.items, 'Success', 200, {
      ...result.meta,
      stats: result.stats,
    });
  }),
);

router.get(
  '/product-moderation/filters',
  hasPermission(PERMISSIONS.PRODUCT_UPDATE),
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await service.getProductModerationFilters());
  }),
);

router.get(
  '/product-moderation',
  hasPermission(PERMISSIONS.PRODUCT_UPDATE),
  validate(listProductModerationQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await service.listProductModeration(req.query as {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      categoryId?: string;
    });
    sendSuccess(res, result.items, 'Success', 200, {
      ...result.meta,
      stats: result.stats,
    });
  }),
);

router.get(
  '/product-moderation/:id',
  hasPermission(PERMISSIONS.PRODUCT_UPDATE),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await service.getProductModerationById(req.params.id));
  }),
);

router.post(
  '/product-moderation/:id/moderate',
  hasPermission(PERMISSIONS.PRODUCT_UPDATE),
  validate(moderateProductSchema),
  asyncHandler(async (req, res) => {
    const product = await service.moderateProduct(
      req.params.id,
      req.user!.sub,
      req.body.action,
      req.body.notes,
    );
    sendSuccess(res, product, 'Product moderation updated');
  }),
);

export default router;
