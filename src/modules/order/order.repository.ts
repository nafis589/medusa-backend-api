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
  AdminOrderListRow,
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

function mapAdminOrderRow(row: mysql.RowDataPacket): AdminOrderListRow {
  const order = mapOrder(row);
  return {
    ...order,
    items_count: Number(row.items_count ?? 0),
    shop_name: String(row.shop_name ?? ''),
  };
}

function normalizeOrderSearchTerm(search: string): string {
  return search.trim().replace(/^CMD-/i, '').replace(/-/g, '');
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
      conditions.push('o.buyer_id = ?');
      params.push(filters.buyer_id);
    }
    if (filters.vendor_id) {
      conditions.push('o.vendor_id = ?');
      params.push(filters.vendor_id);
    }
    if (filters.status) {
      conditions.push('o.status = ?');
      params.push(filters.status);
    }
    if (filters.date_from) {
      conditions.push('DATE(o.created_at) >= ?');
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      conditions.push('DATE(o.created_at) <= ?');
      params.push(filters.date_to);
    }
    if (filters.search?.trim()) {
      const term = `%${filters.search.trim()}%`;
      const idTerm = `%${normalizeOrderSearchTerm(filters.search)}%`;
      conditions.push(`(
        REPLACE(o.id, '-', '') LIKE ?
        OR JSON_UNQUOTE(JSON_EXTRACT(o.shipping_address, '$.first_name')) LIKE ?
        OR JSON_UNQUOTE(JSON_EXTRACT(o.shipping_address, '$.last_name')) LIKE ?
        OR CONCAT(
          JSON_UNQUOTE(JSON_EXTRACT(o.shipping_address, '$.first_name')),
          ' ',
          JSON_UNQUOTE(JSON_EXTRACT(o.shipping_address, '$.last_name'))
        ) LIKE ?
      )`);
      params.push(idTerm, term, term, term);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await this.pool.query(
      `SELECT COUNT(*) AS total FROM orders o ${where}`,
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

  async listForAdmin(filters: OrderListFilters): Promise<{ orders: AdminOrderListRow[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.buyer_id) {
      conditions.push('o.buyer_id = ?');
      params.push(filters.buyer_id);
    }
    if (filters.vendor_id) {
      conditions.push('o.vendor_id = ?');
      params.push(filters.vendor_id);
    }
    if (filters.status) {
      conditions.push('o.status = ?');
      params.push(filters.status);
    }
    if (filters.date_from) {
      conditions.push('DATE(o.created_at) >= ?');
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      conditions.push('DATE(o.created_at) <= ?');
      params.push(filters.date_to);
    }
    if (filters.search?.trim()) {
      const term = `%${filters.search.trim()}%`;
      const idTerm = `%${normalizeOrderSearchTerm(filters.search)}%`;
      conditions.push(`(
        REPLACE(o.id, '-', '') LIKE ?
        OR JSON_UNQUOTE(JSON_EXTRACT(o.shipping_address, '$.first_name')) LIKE ?
        OR JSON_UNQUOTE(JSON_EXTRACT(o.shipping_address, '$.last_name')) LIKE ?
        OR CONCAT(
          JSON_UNQUOTE(JSON_EXTRACT(o.shipping_address, '$.first_name')),
          ' ',
          JSON_UNQUOTE(JSON_EXTRACT(o.shipping_address, '$.last_name'))
        ) LIKE ?
      )`);
      params.push(idTerm, term, term, term);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await this.pool.query(
      `SELECT COUNT(*) AS total
       FROM orders o
       INNER JOIN vendors v ON v.id = o.vendor_id
       ${where}`,
      params,
    );
    const total = Number((countRows as mysql.RowDataPacket[])[0]?.total ?? 0);

    const [rows] = await this.pool.query(
      `SELECT o.*,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS items_count,
        v.shop_name
       FROM orders o
       INNER JOIN vendors v ON v.id = o.vendor_id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, filters.limit, filters.offset],
    );

    return {
      orders: (rows as mysql.RowDataPacket[]).map(mapAdminOrderRow),
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

  async findAdminVendorSummary(vendorId: string): Promise<{ id: string; shop_name: string; email: string; user_id: string } | null> {
    const [rows] = await this.pool.query(
      `SELECT v.id, v.shop_name, v.user_id, u.email
       FROM vendors v
       INNER JOIN users u ON u.id = v.user_id
       WHERE v.id = ?`,
      [vendorId],
    );
    const results = rows as mysql.RowDataPacket[];
    if (results.length === 0) return null;
    return {
      id: results[0].id as string,
      shop_name: results[0].shop_name as string,
      email: results[0].email as string,
      user_id: results[0].user_id as string,
    };
  }

  async findAdminBuyerSummary(buyerId: string): Promise<{ id: string; first_name: string; last_name: string; email: string; phone: string | null } | null> {
    const [rows] = await this.pool.query(
      'SELECT id, first_name, last_name, email, phone FROM users WHERE id = ?',
      [buyerId],
    );
    const results = rows as mysql.RowDataPacket[];
    if (results.length === 0) return null;
    return {
      id: results[0].id as string,
      first_name: results[0].first_name as string,
      last_name: results[0].last_name as string,
      email: results[0].email as string,
      phone: (results[0].phone as string | null) ?? null,
    };
  }
}
