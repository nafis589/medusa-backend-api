import { getPool } from '@shared/utils/db';
import type mysql from 'mysql2/promise';
import type { ICartRepository } from './cart.repository.interface';
import type { Cart, CreateCartData } from './cart.entity';

function mapCart(row: mysql.RowDataPacket): Cart {
  return {
    id: row.id as string,
    user_id: (row.user_id as string | null) ?? null,
    session_id: (row.session_id as string | null) ?? null,
    created_at: row.created_at as Date,
    updated_at: row.updated_at as Date,
  };
}

export class CartRepository implements ICartRepository {
  private get pool(): mysql.Pool {
    return getPool();
  }

  async findById(id: string): Promise<Cart | null> {
    const [rows] = await this.pool.query('SELECT * FROM carts WHERE id = ?', [id]);
    const results = rows as mysql.RowDataPacket[];
    return results.length > 0 ? mapCart(results[0]) : null;
  }

  async findByUserId(userId: string): Promise<Cart | null> {
    const [rows] = await this.pool.query('SELECT * FROM carts WHERE user_id = ? LIMIT 1', [userId]);
    const results = rows as mysql.RowDataPacket[];
    return results.length > 0 ? mapCart(results[0]) : null;
  }

  async findBySessionId(sessionId: string): Promise<Cart | null> {
    const [rows] = await this.pool.query('SELECT * FROM carts WHERE session_id = ? LIMIT 1', [
      sessionId,
    ]);
    const results = rows as mysql.RowDataPacket[];
    return results.length > 0 ? mapCart(results[0]) : null;
  }

  async create(data: CreateCartData & { id: string }): Promise<Cart> {
    await this.pool.query(
      'INSERT INTO carts (id, user_id, session_id) VALUES (?, ?, ?)',
      [data.id, data.user_id ?? null, data.session_id ?? null],
    );
    const created = await this.findById(data.id);
    if (!created) {
      throw new Error(`Failed to find created cart with id: ${data.id}`);
    }
    return created;
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM carts WHERE id = ?', [id]);
  }
}
