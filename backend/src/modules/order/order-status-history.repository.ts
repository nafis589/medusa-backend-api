import { getPool } from '@shared/utils/db';
import type mysql from 'mysql2/promise';
import type { PoolConnection } from 'mysql2/promise';
import type { IOrderStatusHistoryRepository } from './order-status-history.repository.interface';
import type { OrderStatusHistory, CreateOrderStatusHistoryData } from './order-status-history.entity';
import type { OrderStatus } from './order.types';

function mapHistory(row: mysql.RowDataPacket): OrderStatusHistory {
  return {
    id: row.id as string,
    order_id: row.order_id as string,
    status: row.status as OrderStatus,
    note: (row.note as string | null) ?? null,
    created_by: row.created_by as string,
    created_at: row.created_at as Date,
  };
}

export class OrderStatusHistoryRepository implements IOrderStatusHistoryRepository {
  private get pool(): mysql.Pool {
    return getPool();
  }

  async findByOrderId(orderId: string): Promise<OrderStatusHistory[]> {
    const [rows] = await this.pool.query(
      'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC',
      [orderId],
    );
    return (rows as mysql.RowDataPacket[]).map(mapHistory);
  }

  async create(
    data: CreateOrderStatusHistoryData & { id: string },
    connection?: PoolConnection,
  ): Promise<OrderStatusHistory> {
    const db = connection ?? this.pool;
    await db.query(
      `INSERT INTO order_status_history (id, order_id, status, note, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [data.id, data.order_id, data.status, data.note ?? null, data.created_by],
    );

    const [rows] = await db.query('SELECT * FROM order_status_history WHERE id = ?', [data.id]);
    const results = rows as mysql.RowDataPacket[];
    if (results.length === 0) {
      throw new Error(`Failed to find created order status history with id: ${data.id}`);
    }
    return mapHistory(results[0]);
  }
}
