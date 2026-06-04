import { Router } from 'express';
import { SellerService } from '../service/seller.service';
import { SellerProductsService } from '../service/seller-products.service';
import { SellerOrdersService } from '../service/seller-orders.service';
import { SellerInventoryService } from '../service/seller-inventory.service';
import { SellerAnalyticsService } from '../service/seller-analytics.service';
import { asyncHandler } from '../../../common/utils/async-handler';
import { sendSuccess } from '../../../common/utils/response.util';
import { authenticate, hasPermission } from '../../../common/middlewares/auth.middleware';
import { validate } from '../../../common/middlewares/validate.middleware';
import { PERMISSIONS } from '../../../common/constants/permissions';
import {
  listSellerProductsQuerySchema,
  listSellerOrdersQuerySchema,
  restockVariantSchema,
  restockVariantBodySchema,
  sellerDashboardQuerySchema,
  sellerInventoryQuerySchema,
  sellerInventorySummaryQuerySchema,
  sellerAnalyticsQuerySchema,
  updateSellerOrderStatusSchema,
  updateVariantStockSchema,
} from '../validator/seller.validator';
import type { SellerProductsListQuery } from '../service/seller-products.service';
import type { SellerOrdersListQuery } from '../service/seller-orders.service';
import type {
  SellerInventoryListQuery,
  SellerInventoryPeriod,
} from '../service/seller-inventory.service';
import type { SellerDashboardPeriod } from '../service/seller.service';
import type { SellerAnalyticsPeriod } from '../service/seller-analytics.service';

const router = Router();
const service = new SellerService();
const productsService = new SellerProductsService();
const ordersService = new SellerOrdersService();
const inventoryService = new SellerInventoryService();
const analyticsService = new SellerAnalyticsService();

async function resolveSellerId(userId: string) {
  const seller = await service.getByUserId(userId);
  return seller.id;
}

router.post('/register', authenticate, hasPermission(PERMISSIONS.SELLER_CREATE), asyncHandler(async (req, res) => {
  const seller = await service.register(req.user!.sub, req.body);
  sendSuccess(res, seller, 'Seller registration submitted', 201);
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const seller = await service.getByUserId(req.user!.sub);
  sendSuccess(res, seller);
}));

router.get(
  '/me/dashboard',
  authenticate,
  validate(sellerDashboardQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const sellerId = await resolveSellerId(req.user!.sub);
    const { period } = req.query as { period: SellerDashboardPeriod };
    const dashboard = await service.getDashboard(sellerId, period);
    sendSuccess(res, dashboard);
  }),
);

router.get(
  '/me/dashboard/export',
  authenticate,
  validate(sellerDashboardQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const sellerId = await resolveSellerId(req.user!.sub);
    const { period } = req.query as { period: SellerDashboardPeriod };
    const csv = await service.exportDashboardCsv(sellerId, period);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="seller-dashboard-${period}.csv"`);
    res.status(200).send(csv);
  }),
);

router.get(
  '/me/products',
  authenticate,
  validate(listSellerProductsQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const sellerId = await resolveSellerId(req.user!.sub);
    const result = await productsService.list(sellerId, req.query as SellerProductsListQuery);
    sendSuccess(res, result.items, 'Success', 200, result.meta);
  }),
);

router.get(
  '/me/products/export',
  authenticate,
  validate(listSellerProductsQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const sellerId = await resolveSellerId(req.user!.sub);
    const { page: _p, limit: _l, ...exportQuery } = req.query as SellerProductsListQuery;
    const csv = await productsService.exportCsv(sellerId, exportQuery);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="seller-products.csv"');
    res.status(200).send(csv);
  }),
);

router.get(
  '/me/orders',
  authenticate,
  hasPermission(PERMISSIONS.ORDER_VIEW),
  validate(listSellerOrdersQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const sellerId = await resolveSellerId(req.user!.sub);
    const result = await ordersService.list(sellerId, req.query as SellerOrdersListQuery);
    sendSuccess(res, result.items, 'Success', 200, result.meta);
  }),
);

router.get(
  '/me/orders/export',
  authenticate,
  hasPermission(PERMISSIONS.ORDER_VIEW),
  validate(listSellerOrdersQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const sellerId = await resolveSellerId(req.user!.sub);
    const { page: _p, limit: _l, ...exportQuery } = req.query as SellerOrdersListQuery;
    const csv = await ordersService.exportCsv(sellerId, exportQuery);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="seller-orders.csv"');
    res.status(200).send(csv);
  }),
);

router.get(
  '/me/orders/:orderId',
  authenticate,
  hasPermission(PERMISSIONS.ORDER_VIEW),
  asyncHandler(async (req, res) => {
    const sellerId = await resolveSellerId(req.user!.sub);
    const order = await ordersService.getById(sellerId, req.params.orderId);
    sendSuccess(res, order);
  }),
);

router.patch(
  '/me/orders/:orderId/status',
  authenticate,
  hasPermission(PERMISSIONS.ORDER_UPDATE),
  validate(updateSellerOrderStatusSchema),
  asyncHandler(async (req, res) => {
    const sellerId = await resolveSellerId(req.user!.sub);
    const order = await ordersService.updateStatus(sellerId, req.params.orderId, req.body.status);
    sendSuccess(res, order, 'Order status updated');
  }),
);

router.get(
  '/me/analytics',
  authenticate,
  hasPermission(PERMISSIONS.ORDER_VIEW),
  validate(sellerAnalyticsQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const sellerId = await resolveSellerId(req.user!.sub);
    const { period } = req.query as { period: SellerAnalyticsPeriod };
    const analytics = await analyticsService.getAnalytics(sellerId, period);
    sendSuccess(res, analytics);
  }),
);

router.get(
  '/me/analytics/export',
  authenticate,
  hasPermission(PERMISSIONS.ORDER_VIEW),
  validate(sellerAnalyticsQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const sellerId = await resolveSellerId(req.user!.sub);
    const { period } = req.query as { period: SellerAnalyticsPeriod };
    const csv = await analyticsService.exportCsv(sellerId, period);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="seller-analytics-${period}.csv"`);
    res.status(200).send(csv);
  }),
);

router.get(
  '/me/inventory/summary',
  authenticate,
  hasPermission(PERMISSIONS.INVENTORY_VIEW),
  validate(sellerInventorySummaryQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const sellerId = await resolveSellerId(req.user!.sub);
    const { period } = req.query as { period: SellerInventoryPeriod };
    const summary = await inventoryService.getSummary(sellerId, period);
    sendSuccess(res, summary);
  }),
);

router.get(
  '/me/inventory',
  authenticate,
  hasPermission(PERMISSIONS.INVENTORY_VIEW),
  validate(sellerInventoryQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const sellerId = await resolveSellerId(req.user!.sub);
    const result = await inventoryService.list(sellerId, req.query as SellerInventoryListQuery);
    sendSuccess(res, result.items, 'Success', 200, result.meta);
  }),
);

router.get(
  '/me/inventory/export',
  authenticate,
  hasPermission(PERMISSIONS.INVENTORY_VIEW),
  validate(sellerInventoryQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const sellerId = await resolveSellerId(req.user!.sub);
    const { page: _p, limit: _l, ...exportQuery } = req.query as SellerInventoryListQuery;
    const csv = await inventoryService.exportCsv(sellerId, exportQuery);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="seller-inventory.csv"');
    res.status(200).send(csv);
  }),
);

router.post(
  '/me/inventory/restock-low-stock',
  authenticate,
  hasPermission(PERMISSIONS.INVENTORY_UPDATE),
  validate(restockVariantSchema),
  asyncHandler(async (req, res) => {
    const sellerId = await resolveSellerId(req.user!.sub);
    const result = await inventoryService.restockLowStock(sellerId, req.body.quantity);
    sendSuccess(res, result, 'Low stock items restocked');
  }),
);

router.patch(
  '/me/inventory/variants/:variantId/stock',
  authenticate,
  hasPermission(PERMISSIONS.INVENTORY_UPDATE),
  validate(updateVariantStockSchema),
  asyncHandler(async (req, res) => {
    const sellerId = await resolveSellerId(req.user!.sub);
    const result = await inventoryService.setAvailableStock(
      sellerId,
      req.params.variantId,
      req.body.availableStock,
    );
    sendSuccess(res, result, 'Stock updated');
  }),
);

router.post(
  '/me/variants/:variantId/restock',
  authenticate,
  hasPermission(PERMISSIONS.INVENTORY_UPDATE),
  validate(restockVariantBodySchema),
  asyncHandler(async (req, res) => {
    const sellerId = await resolveSellerId(req.user!.sub);
    const result = await inventoryService.restockVariant(
      sellerId,
      req.params.variantId,
      req.body.quantity,
    );
    sendSuccess(res, result, 'Stock updated');
  }),
);

router.get('/pending', authenticate, hasPermission(PERMISSIONS.SELLER_APPROVE), asyncHandler(async (req, res) => {
  const result = await service.listPending(Number(req.query.page), Number(req.query.limit));
  sendSuccess(res, result.items, 'Success', 200, { total: result.total });
}));

router.post('/:id/approve', authenticate, hasPermission(PERMISSIONS.SELLER_APPROVE), asyncHandler(async (req, res) => {
  const seller = await service.approve(req.params.id, req.user!.sub);
  sendSuccess(res, seller, 'Seller approved');
}));

router.post('/:id/reject', authenticate, hasPermission(PERMISSIONS.SELLER_APPROVE), asyncHandler(async (req, res) => {
  const seller = await service.reject(req.params.id, req.body.note ?? 'Rejected');
  sendSuccess(res, seller, 'Seller rejected');
}));

export default router;
