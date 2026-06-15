import { getPool } from '@shared/utils/db';
import type mysql from 'mysql2/promise';
import type { PoolConnection } from 'mysql2/promise';
import type { IOrderRepository } from './order.repository.interface';
import type { Order, CreateOrderData } from './order.entity';
import type {
  OrderStatus,
  PaymentMethod,
  ShippingAddress,
  ShippingMethod,
  OrderListFilters,
  OrderVendorSummary,
} from './order.types';

function parseJson<T>(value: unknown): T {
  if (value === null || value === undefined) {
    throw new Error('Expected JSON column value');
  }
  if (typeof value === 'string') {
    return JSON.parse(value) as T;
  }
  return value as T;
}

function mapOrder(row: mysql.RowDataPacket): Order & { items_count?: number } {
  const order: Order & { items_count?: number } = {
    id: row.id as string,
    buyer_id: row.buyer_id as string,
    vendor_id: row.vendor_id as string,
    status: row.status as OrderStatus,
    total_amount: Number(row.total_amount),
    shipping_fee: Number(row.shipping_fee),
    payment_method: row.payment_method as PaymentMethod,
    shipping_address: parseJson<ShippingAddress>(row.shipping_address),
    shipping_region_id: row.shipping_region_id as string,
    shipping_method: row.shipping_method as ShippingMethod,
    shipping_distance_km:
      row.shipping_distance_km === null ? null : Number(row.shipping_distance_km),
    tracking_number: (row.tracking_number as string | null) ?? null,
    created_at: row.created_at as Date,
    updated_at: row.updated_at as Date,
  };
  if (row.items_count !== undefined) {
    order.items_count = Number(row.items_count);
  }
  return order;
}

export class OrderRepository implements IOrderRepository {
  private get pool(): mysql.Pool {
    return getPool();
  }

  async findById(id: string): Promise<Order | null> {
    const [rows] = await this.pool.query('SELECT * FROM orders WHERE id = ?', [id]);
    const results = rows as mysql.RowDataPacket[];
    return results.length > 0 ? mapOrder(results[0]) : null;
  }

  async create(
    data: CreateOrderData & { id: string },
    connection?: PoolConnection,
  ): Promise<Order> {
    const db = connection ?? this.pool;
    await db.query(
      `INSERT INTO orders (
        id, buyer_id, vendor_id, status, total_amount, shipping_fee,
        payment_method, shipping_address, shipping_region_id, shipping_method,
        shipping_distance_km, tracking_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.id,
        data.buyer_id,
        data.vendor_id,
        data.status ?? 'PENDING',
        data.total_amount,
        data.shipping_fee,
        data.payment_method ?? 'CASH_ON_DELIVERY',
        JSON.stringify(data.shipping_address),
        data.shipping_region_id,
        data.shipping_method,
        data.shipping_distance_km ?? null,
        data.tracking_number ?? null,
      ],
    );

    if (connection) {
      const [rows] = await connection.query('SELECT * FROM orders WHERE id = ?', [data.id]);
      const results = rows as mysql.RowDataPacket[];
      if (results.length === 0) {
        throw new Error(`Failed to find created order with id: ${data.id}`);
      }
      return mapOrder(results[0]);
    }

    const created = await this.findById(data.id);
    if (!created) {
      throw new Error(`Failed to find created order with id: ${data.id}`);
    }
    return created;
  }

  async list(filters: OrderListFilters): Promise<{ orders: Order[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.buyer_id) {
      conditions.push('buyer_id = ?');
      params.push(filters.buyer_id);
    }
    if (filters.vendor_id) {
      conditions.push('vendor_id = ?');
      params.push(filters.vendor_id);
    }
    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await this.pool.query(
      `SELECT COUNT(*) AS total FROM orders ${where}`,
      params,
    );
    const total = Number((countRows as mysql.RowDataPacket[])[0]?.total ?? 0);

    const [rows] = await this.pool.query(
      `SELECT o.*,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS items_count
       FROM orders o
       ${where}
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, filters.limit, filters.offset],
    );

    return {
      orders: (rows as mysql.RowDataPacket[]).map(mapOrder),
      total,
    };
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    connection?: PoolConnection,
  ): Promise<Order> {
    const db = connection ?? this.pool;
    await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);

    const [rows] = await db.query('SELECT * FROM orders WHERE id = ?', [id]);
    const results = rows as mysql.RowDataPacket[];
    if (results.length === 0) {
      throw new Error(`Failed to find updated order with id: ${id}`);
    }
    return mapOrder(results[0]);
  }

  async findVendorSummary(vendorId: string): Promise<OrderVendorSummary | null> {
    const [rows] = await this.pool.query(
      'SELECT id, shop_name FROM vendors WHERE id = ?',
      [vendorId],
    );
    const results = rows as mysql.RowDataPacket[];
    if (results.length === 0) return null;
    return {
      id: results[0].id as string,
      shop_name: results[0].shop_name as string,
    };
  }
}
