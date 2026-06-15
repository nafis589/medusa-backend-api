import { Router } from 'express';
import { AppError } from '@shared/errors/app-error';
import { validate, validateParams, validateQuery } from '@shared/middlewares/validate';
import { getActiveVendorIdByUserId } from '@modules/vendor/vendor.util';
import { createOrderService } from './order.factory';
import {
  OrderListQuerySchema,
  OrderIdSchema,
  UpdateOrderStatusSchema,
  type OrderListQueryInput,
  type UpdateOrderStatusBody,
} from './order.schema';
import { mapOrderDetailResponse, mapOrdersResponse } from './order.mapper';
import type { OrderStatus } from './order.types';

const router = Router();
const service = createOrderService();

async function resolveVendorId(req: import('express').Request): Promise<string> {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'No token provided');
  }
  return getActiveVendorIdByUserId(userId);
}

/**
 * GET /api/vendor/orders
 */
router.get('/', validateQuery(OrderListQuerySchema), async (req, res, next) => {
  try {
    const vendorId = await resolveVendorId(req);
    const query = req.query as unknown as OrderListQueryInput;
    const { orders, total, page, limit } = await service.listForVendor(
      vendorId,
      query.status as OrderStatus | undefined,
      query.page,
      query.limit,
    );
    res.json({
      data: mapOrdersResponse(orders),
      meta: service.getListMeta(total, page, limit),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/vendor/orders/:id
 */
router.get('/:id', validateParams(OrderIdSchema), async (req, res, next) => {
  try {
    const vendorId = await resolveVendorId(req);
    const { id } = req.params as { id: string };
    const detail = await service.getOrderForVendor(id, vendorId);
    res.json({ data: mapOrderDetailResponse(detail) });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/vendor/orders/:id/status
 */
router.patch(
  '/:id/status',
  validateParams(OrderIdSchema),
  validate(UpdateOrderStatusSchema),
  async (req, res, next) => {
    try {
      const vendorId = await resolveVendorId(req);
      const { id } = req.params as { id: string };
      const body = req.body as UpdateOrderStatusBody;
      const order = await service.updateOrderStatus(
        id,
        vendorId,
        req.user!.id,
        body.status,
        body.note,
      );
      res.json({ data: mapOrdersResponse([order])[0] });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
