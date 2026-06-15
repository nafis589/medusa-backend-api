import { Router } from 'express';
import { authenticate } from '@shared/middlewares/authenticate';
import { authorize } from '@shared/middlewares/authorize';
import { validate, validateParams, validateQuery } from '@shared/middlewares/validate';
import { createOrderService } from '@modules/order/order.factory';
import {
  PlaceOrderSchema,
  OrderListQuerySchema,
  OrderIdSchema,
  type PlaceOrderBody,
  type OrderListQueryInput,
} from '@modules/order/order.schema';
import { mapOrderDetailResponse, mapOrdersResponse } from '@modules/order/order.mapper';
import type { OrderStatus } from '@modules/order/order.types';

const router = Router();
const service = createOrderService();

router.use(authenticate);
router.use(authorize('BUYER'));

/**
 * POST /api/store/orders
 */
router.post('/', validate(PlaceOrderSchema), async (req, res, next) => {
  try {
    const body = req.body as PlaceOrderBody;
    const orders = await service.placeOrder(req.user!.id, body);
    res.status(201).json({ data: { orders: mapOrdersResponse(orders) } });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/store/orders
 */
router.get('/', validateQuery(OrderListQuerySchema), async (req, res, next) => {
  try {
    const query = req.query as unknown as OrderListQueryInput;
    const { orders, total, page, limit } = await service.listForBuyer(
      req.user!.id,
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
 * POST /api/store/orders/:id/cancel
 */
router.post('/:id/cancel', validateParams(OrderIdSchema), async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const order = await service.cancelOrder(id, req.user!.id);
    res.json({ data: mapOrdersResponse([order])[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/store/orders/:id
 */
router.get('/:id', validateParams(OrderIdSchema), async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const detail = await service.getOrderForBuyer(id, req.user!.id);
    res.json({ data: mapOrderDetailResponse(detail) });
  } catch (err) {
    next(err);
  }
});

export default router;
