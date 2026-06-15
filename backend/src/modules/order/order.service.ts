import { randomUUID } from 'crypto';
import { getPool } from '@shared/utils/db';
import { AppError } from '@shared/errors/app-error';
import { eventBus } from '@shared/utils/event-bus';
import { getPagination, getPaginationMeta } from '@shared/utils/pagination';
import type { PaginationMeta } from '@shared/utils/pagination';
import type { PlaceOrderWorkflow } from '@workflows/place-order.workflow';
import type { IOrderRepository } from './order.repository.interface';
import type { IOrderItemRepository } from './order-item.repository.interface';
import type { IOrderStatusHistoryRepository } from './order-status-history.repository.interface';
import type { IProductRepository } from '@modules/product/product.repository.interface';
import type { Order } from './order.entity';
import type { OrderStatus } from './order.types';
import type { PlaceOrderBody } from './order.schema';
import type { OrderDetail, OrderListResult } from './order.service.types';

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING'],
  PREPARING: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

export class OrderService {
  constructor(
    private readonly placeOrderWorkflow: PlaceOrderWorkflow,
    private readonly orderRepo: IOrderRepository,
    private readonly orderItemRepo: IOrderItemRepository,
    private readonly orderStatusHistoryRepo: IOrderStatusHistoryRepository,
    private readonly productRepo: IProductRepository,
  ) {}

  async placeOrder(buyerId: string, body: PlaceOrderBody): Promise<Order[]> {
    const result = await this.placeOrderWorkflow.execute({
      buyerId,
      shippingAddress: body.shipping_address,
      shippingFee: body.shipping_fee,
      shippingMethod: body.shipping_method,
      shippingDistanceKm: body.shipping_distance_km ?? null,
      paymentMethod: body.payment_method,
    });
    return result.orders;
  }

  async listForBuyer(
    buyerId: string,
    status: OrderStatus | undefined,
    page: number,
    limit: number,
  ): Promise<OrderListResult> {
    const { offset, limit: safeLimit } = getPagination(page, limit);
    const { orders, total } = await this.orderRepo.list({
      buyer_id: buyerId,
      status,
      offset,
      limit: safeLimit,
    });
    return { orders, total, page, limit: safeLimit };
  }

  async listForVendor(
    vendorId: string,
    status: OrderStatus | undefined,
    page: number,
    limit: number,
  ): Promise<OrderListResult> {
    const { offset, limit: safeLimit } = getPagination(page, limit);
    const { orders, total } = await this.orderRepo.list({
      vendor_id: vendorId,
      status,
      offset,
      limit: safeLimit,
    });
    return { orders, total, page, limit: safeLimit };
  }

  async listForAdmin(
    filters: {
      status?: OrderStatus;
      vendor_id?: string;
      page: number;
      limit: number;
    },
  ): Promise<OrderListResult> {
    const { offset, limit: safeLimit } = getPagination(filters.page, filters.limit);
    const { orders, total } = await this.orderRepo.list({
      vendor_id: filters.vendor_id,
      status: filters.status,
      offset,
      limit: safeLimit,
    });
    return { orders, total, page: filters.page, limit: safeLimit };
  }

  getListMeta(total: number, page: number, limit: number): PaginationMeta {
    return getPaginationMeta(total, page, limit);
  }

  async getOrderForBuyer(orderId: string, buyerId: string): Promise<OrderDetail> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) {
      throw AppError.notFound('Order');
    }
    if (order.buyer_id !== buyerId) {
      throw AppError.forbidden('You do not have access to this order');
    }
    return this.buildOrderDetail(order);
  }

  async getOrderForVendor(orderId: string, vendorId: string): Promise<OrderDetail> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) {
      throw AppError.notFound('Order');
    }
    if (order.vendor_id !== vendorId) {
      throw AppError.forbidden('You do not have access to this order');
    }
    return this.buildOrderDetail(order);
  }

  async cancelOrder(orderId: string, buyerId: string): Promise<Order> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) {
      throw AppError.notFound('Order');
    }
    if (order.buyer_id !== buyerId) {
      throw AppError.forbidden('You do not have access to this order');
    }
    if (order.status !== 'PENDING') {
      throw new AppError(400, 'ORDER_NOT_CANCELLABLE', 'Only pending orders can be cancelled');
    }

    const items = await this.orderItemRepo.findByOrderId(orderId);
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const updated = await this.orderRepo.updateStatus(orderId, 'CANCELLED', connection);

      for (const item of items) {
        if (item.product_id) {
          await this.productRepo.incrementStock(item.product_id, item.quantity, connection);
        }
      }

      await this.orderStatusHistoryRepo.create(
        {
          id: randomUUID(),
          order_id: orderId,
          status: 'CANCELLED',
          note: 'Cancelled by buyer',
          created_by: buyerId,
        },
        connection,
      );

      await connection.commit();
      eventBus.emitOrderCancelled({ order: updated });
      return updated;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  async updateOrderStatus(
    orderId: string,
    vendorId: string,
    userId: string,
    newStatus: OrderStatus,
    note?: string | null,
  ): Promise<Order> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) {
      throw AppError.notFound('Order');
    }
    if (order.vendor_id !== vendorId) {
      throw AppError.forbidden('You do not have access to this order');
    }

    this.assertStatusTransition(order.status, newStatus);

    const previousStatus = order.status;
    const updated = await this.orderRepo.updateStatus(orderId, newStatus);

    await this.orderStatusHistoryRepo.create({
      id: randomUUID(),
      order_id: orderId,
      status: newStatus,
      note: note ?? null,
      created_by: userId,
    });

    eventBus.emitOrderStatusChanged({
      order: updated,
      previousStatus,
      newStatus,
      note: note ?? null,
    });

    return updated;
  }

  private assertStatusTransition(current: OrderStatus, next: OrderStatus): void {
    const allowed = ALLOWED_TRANSITIONS[current];
    if (!allowed.includes(next)) {
      throw new AppError(
        400,
        'INVALID_STATUS_TRANSITION',
        `Cannot transition from ${current} to ${next}`,
      );
    }
  }

  private async buildOrderDetail(order: Order): Promise<OrderDetail> {
    const [items, status_history, vendor] = await Promise.all([
      this.orderItemRepo.findByOrderId(order.id),
      this.orderStatusHistoryRepo.findByOrderId(order.id),
      this.orderRepo.findVendorSummary(order.vendor_id),
    ]);

    if (!vendor) {
      throw AppError.notFound('Vendor');
    }

    return { order, items, status_history, vendor };
  }
}
