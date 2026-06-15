import { Router } from 'express';
import { validateQuery } from '@shared/middlewares/validate';
import { createOrderService } from './order.factory';
import { AdminOrderListQuerySchema, type AdminOrderListQueryInput } from './order.schema';
import { mapOrdersResponse } from './order.mapper';
import type { OrderStatus } from './order.types';

const router = Router();
const service = createOrderService();

/**
 * GET /api/admin/orders
 */
router.get('/', validateQuery(AdminOrderListQuerySchema), async (req, res, next) => {
  try {
    const query = req.query as unknown as AdminOrderListQueryInput;
    const { orders, total, page, limit } = await service.listForAdmin({
      status: query.status as OrderStatus | undefined,
      vendor_id: query.vendor_id,
      page: query.page,
      limit: query.limit,
    });
    res.json({
      data: mapOrdersResponse(orders),
      meta: service.getListMeta(total, page, limit),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
