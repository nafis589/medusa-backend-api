import { randomUUID } from 'crypto';
import type mysql from 'mysql2/promise';
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
import type { OrderDetail, OrderListResult, AdminOrderDetail } from './order.service.types';
import { findVendorIdByUserId } from '@modules/vendor/vendor.util';

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED', 'REFUSED'],
  CONFIRMED: ['PREPARING'],
  PREPARING: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
  REFUSED: [],
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
    const buyerVendorId = (await findVendorIdByUserId(buyerId)) ?? undefined;
    const result = await this.placeOrderWorkflow.execute({
      buyerId,
      buyerVendorId,
      shippingAddress: body.shipping_address,
      paymentMethod: body.payment_method,
      vendorShippings: body.vendor_shippings.map((entry) => ({
        vendorId: entry.vendor_id,
        shippingFee: entry.shipping_fee,
        shippingMethod: entry.shipping_method,
        shippingDistanceKm: entry.shipping_distance_km ?? null,
        shippingDetail: entry.shipping_detail,
      })),
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
      buyer_id?: string;
      search?: string;
      date_from?: string;
      date_to?: string;
      page: number;
      limit: number;
    },
  ): Promise<OrderListResult & { orders: import('./order.types').AdminOrderListRow[] }> {
    const { offset, limit: safeLimit } = getPagination(filters.page, filters.limit);
    const { orders, total } = await this.orderRepo.listForAdmin({
      vendor_id: filters.vendor_id,
      buyer_id: filters.buyer_id,
      status: filters.status,
      search: filters.search,
      date_from: filters.date_from,
      date_to: filters.date_to,
      offset,
      limit: safeLimit,
    });
    return { orders, total, page: filters.page, limit: safeLimit };
  }

  async getAdminOrderStats(): Promise<{
    orders_today: number;
    revenue_today: number;
    pending_processing: number;
    delivery_rate: number;
  }> {
    const pool = getPool();
    const [ordersTodayRows] = await pool.query(
      `SELECT COUNT(*) AS value FROM orders WHERE DATE(created_at) = CURDATE()`,
    );
    const [revenueTodayRows] = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS value FROM orders WHERE DATE(created_at) = CURDATE()`,
    );
    const [pendingRows] = await pool.query(
      `SELECT COUNT(*) AS value FROM orders WHERE status IN ('PENDING', 'CONFIRMED', 'PREPARING')`,
    );
    const [deliveryRows] = await pool.query(
      `SELECT
         SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) AS delivered,
         SUM(CASE WHEN status IN ('DELIVERED', 'CANCELLED', 'RETURNED', 'REFUSED') THEN 1 ELSE 0 END) AS finalized
       FROM orders`,
    );
    const delivered = Number((deliveryRows as mysql.RowDataPacket[])[0]?.delivered ?? 0);
    const finalized = Number((deliveryRows as mysql.RowDataPacket[])[0]?.finalized ?? 0);
    const delivery_rate = finalized > 0 ? Math.round((delivered / finalized) * 1000) / 10 : 0;

    return {
      orders_today: Number((ordersTodayRows as mysql.RowDataPacket[])[0]?.value ?? 0),
      revenue_today: Number((revenueTodayRows as mysql.RowDataPacket[])[0]?.value ?? 0),
      pending_processing: Number((pendingRows as mysql.RowDataPacket[])[0]?.value ?? 0),
      delivery_rate,
    };
  }

  async getOrderForAdmin(orderId: string): Promise<AdminOrderDetail> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) {
      throw AppError.notFound('Order');
    }
    return this.buildAdminOrderDetail(order);
  }

  async cancelOrderByAdmin(orderId: string, adminUserId: string, reason: string): Promise<Order> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) {
      throw AppError.notFound('Order');
    }
    const cancellable: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPED'];
    if (!cancellable.includes(order.status)) {
      throw new AppError(
        400,
        'ORDER_NOT_CANCELLABLE',
        'Cette commande ne peut plus être annulée',
      );
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
          note: `Annulation admin : ${reason}`,
          created_by: adminUserId,
        },
        connection,
      );

      await connection.commit();
      eventBus.emitOrderCancelled({ order: updated, reason, cancelledBy: 'admin' });
      return updated;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
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

  async refuseOrderByVendor(
    orderId: string,
    vendorId: string,
    vendorUserId: string,
    reason?: string,
  ): Promise<Order> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) {
      throw AppError.notFound('Order');
    }
    if (order.vendor_id !== vendorId) {
      throw AppError.forbidden('You do not have access to this order');
    }
    if (order.status !== 'PENDING') {
      throw new AppError(
        400,
        'ORDER_CANNOT_BE_REFUSED',
        'Seules les commandes en attente peuvent être refusées',
      );
    }

    const items = await this.orderItemRepo.findByOrderId(orderId);
    const vendor = await this.orderRepo.findVendorSummary(vendorId);
    if (!vendor) {
      throw AppError.notFound('Vendor');
    }

    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const updated = await this.orderRepo.updateStatus(orderId, 'REFUSED', connection);

      for (const item of items) {
        if (item.product_id) {
          await this.productRepo.incrementStock(item.product_id, item.quantity, connection);
        }
      }

      await this.orderStatusHistoryRepo.create(
        {
          id: randomUUID(),
          order_id: orderId,
          status: 'REFUSED',
          note: reason?.trim() || null,
          created_by: vendorUserId,
        },
        connection,
      );

      await connection.commit();

      eventBus.emitOrderRefused({
        order: updated,
        reason: reason?.trim() || undefined,
        vendorShopName: vendor.shop_name,
      });

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

  private async buildAdminOrderDetail(order: Order): Promise<AdminOrderDetail> {
    const [items, status_history, vendorRow, buyer] = await Promise.all([
      this.orderItemRepo.findByOrderId(order.id),
      this.orderStatusHistoryRepo.findByOrderId(order.id),
      this.orderRepo.findAdminVendorSummary(order.vendor_id),
      this.orderRepo.findAdminBuyerSummary(order.buyer_id),
    ]);

    if (!vendorRow) {
      throw AppError.notFound('Vendor');
    }
    if (!buyer) {
      throw AppError.notFound('Buyer');
    }

    const itemsWithStatus = await Promise.all(
      items.map(async (item) => {
        let product_status: string | null = null;
        if (item.product_id) {
          const product = await this.productRepo.findById(item.product_id);
          product_status = product?.status ?? null;
        }
        return { ...item, product_status };
      }),
    );

    const vendorUserId = vendorRow.user_id;
    const authorIds = [...new Set(status_history.map((entry) => entry.created_by))];
    const authorMap = new Map<string, { name: string; role: 'Acheteur' | 'Vendeur' | 'Admin' }>();

    for (const authorId of authorIds) {
      if (authorId === order.buyer_id) {
        authorMap.set(authorId, {
          name: `${buyer.first_name} ${buyer.last_name}`.trim(),
          role: 'Acheteur',
        });
        continue;
      }
      if (authorId === vendorUserId) {
        authorMap.set(authorId, { name: vendorRow.shop_name, role: 'Vendeur' });
        continue;
      }
      const pool = getPool();
      const [rows] = await pool.query(
        'SELECT first_name, last_name, role FROM users WHERE id = ?',
        [authorId],
      );
      const user = (rows as mysql.RowDataPacket[])[0];
      if (user) {
        const name = `${user.first_name as string} ${user.last_name as string}`.trim();
        const role =
          user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
            ? 'Admin'
            : user.role === 'VENDOR'
              ? 'Vendeur'
              : 'Acheteur';
        authorMap.set(authorId, { name, role });
      } else {
        authorMap.set(authorId, { name: 'Utilisateur inconnu', role: 'Admin' });
      }
    }

    const enrichedHistory = status_history.map((entry) => {
      const author = authorMap.get(entry.created_by) ?? { name: 'Utilisateur inconnu', role: 'Admin' as const };
      return {
        ...entry,
        author_name: author.name,
        author_role: author.role,
      };
    });

    return {
      order,
      items: itemsWithStatus,
      status_history: enrichedHistory,
      vendor: {
        id: vendorRow.id,
        shop_name: vendorRow.shop_name,
        email: vendorRow.email,
      },
      buyer: {
        id: buyer.id,
        first_name: buyer.first_name,
        last_name: buyer.last_name,
        email: buyer.email,
        phone: buyer.phone ?? order.shipping_address.phone,
      },
    };
  }
}
