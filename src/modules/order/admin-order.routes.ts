import { Router } from 'express';
import { validate, validateParams, validateQuery } from '@shared/middlewares/validate';
import { createOrderService } from './order.factory';
import {
  AdminCancelOrderSchema,
  AdminOrderListQuerySchema,
  OrderIdSchema,
  type AdminCancelOrderBody,
  type AdminOrderListQueryInput,
} from './order.schema';
import { mapAdminOrderDetailResponse, mapAdminOrdersResponse } from './order.mapper';
import type { OrderStatus } from './order.types';

const router = Router();
const service = createOrderService();

/**
 * GET /api/admin/orders/stats
 */
router.get('/stats', async (_req, res, next) => {
  try {
    const stats = await service.getAdminOrderStats();
    res.json({ data: stats });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/orders
 */
router.get('/', validateQuery(AdminOrderListQuerySchema), async (req, res, next) => {
  try {
    const query = req.query as unknown as AdminOrderListQueryInput;
    const { orders, total, page, limit } = await service.listForAdmin({
      status: query.status as OrderStatus | undefined,
      vendor_id: query.vendor_id,
      buyer_id: query.buyer_id,
      search: query.search,
      date_from: query.date_from,
      date_to: query.date_to,
      page: query.page,
      limit: query.limit,
    });
    res.json({
      data: mapAdminOrdersResponse(orders),
      meta: service.getListMeta(total, page, limit),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/orders/:id
 */
router.get('/:id', validateParams(OrderIdSchema), async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const detail = await service.getOrderForAdmin(id);
    res.json({ data: mapAdminOrderDetailResponse(detail) });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/admin/orders/:id/cancel
 */
router.patch(
  '/:id/cancel',
  validateParams(OrderIdSchema),
  validate(AdminCancelOrderSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as AdminCancelOrderBody;
      const order = await service.cancelOrderByAdmin(id, req.user!.id, body.reason);
      res.json({ data: mapAdminOrdersResponse([{ ...order, items_count: 0, shop_name: '' }])[0] });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
