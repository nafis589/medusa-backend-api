import { getPool } from '@shared/utils/db';
import type mysql from 'mysql2/promise';
import type { PoolConnection } from 'mysql2/promise';
import type { IOrderItemRepository } from './order-item.repository.interface';
import type { OrderItem, CreateOrderItemData } from './order-item.entity';
import type { ProductSnapshot } from './order.types';

function parseJson<T>(value: unknown): T {
  if (value === null || value === undefined) {
    throw new Error('Expected JSON column value');
  }
  if (typeof value === 'string') {
    return JSON.parse(value) as T;
  }
  return value as T;
}

function mapOrderItem(row: mysql.RowDataPacket): OrderItem {
  return {
    id: row.id as string,
    order_id: row.order_id as string,
    product_id: (row.product_id as string | null) ?? null,
    quantity: Number(row.quantity),
    unit_price: Number(row.unit_price),
    offer_id: (row.offer_id as string | null) ?? null,
    original_price: row.original_price != null ? Number(row.original_price) : null,
    product_snapshot: parseJson<ProductSnapshot>(row.product_snapshot),
  };
}

export class OrderItemRepository implements IOrderItemRepository {
  private get pool(): mysql.Pool {
    return getPool();
  }

  async findByOrderId(orderId: string): Promise<OrderItem[]> {
    const [rows] = await this.pool.query(
      'SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC',
      [orderId],
    );
    return (rows as mysql.RowDataPacket[]).map(mapOrderItem);
  }

  async create(
    data: CreateOrderItemData & { id: string },
    connection?: PoolConnection,
  ): Promise<OrderItem> {
    const db = connection ?? this.pool;
    await db.query(
      `INSERT INTO order_items
         (id, order_id, product_id, quantity, unit_price, offer_id, original_price, product_snapshot)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.id,
        data.order_id,
        data.product_id,
        data.quantity,
        data.unit_price,
        data.offer_id ?? null,
        data.original_price ?? null,
        JSON.stringify(data.product_snapshot),
      ],
    );

    const [rows] = await db.query('SELECT * FROM order_items WHERE id = ?', [data.id]);
    const results = rows as mysql.RowDataPacket[];
    if (results.length === 0) {
      throw new Error(`Failed to find created order item with id: ${data.id}`);
    }
    return mapOrderItem(results[0]);
  }
}
