import { getPool } from '@shared/utils/db';
import type mysql from 'mysql2/promise';
import type { PoolConnection } from 'mysql2/promise';
import type { ICartItemRepository } from './cart-item.repository.interface';
import type { CartItem, CreateCartItemData } from './cart-item.entity';
import type { CartItemWithProduct } from './cart.types';
import type { ProductStatus } from '@modules/product/product.entity';

function mapCartItem(row: mysql.RowDataPacket): CartItem {
  return {
    id: row.id as string,
    cart_id: row.cart_id as string,
    product_id: row.product_id as string,
    quantity: Number(row.quantity),
    price_snapshot: Number(row.price_snapshot),
  };
}

function mapCartItemWithProduct(row: mysql.RowDataPacket): CartItemWithProduct {
  return {
    ...mapCartItem(row),
    product: {
      title: row.title as string,
      primary_image: (row.primary_image as string | null) ?? null,
      price: Number(row.price),
      status: row.status as ProductStatus,
    },
  };
}

export class CartItemRepository implements ICartItemRepository {
  private get pool(): mysql.Pool {
    return getPool();
  }

  async findById(id: string): Promise<CartItem | null> {
    const [rows] = await this.pool.query('SELECT * FROM cart_items WHERE id = ?', [id]);
    const results = rows as mysql.RowDataPacket[];
    return results.length > 0 ? mapCartItem(results[0]) : null;
  }

  async findByCartId(cartId: string): Promise<CartItemWithProduct[]> {
    const [rows] = await this.pool.query(
      `SELECT ci.*, p.title, p.price, p.status, pi.url AS primary_image
       FROM cart_items ci
       INNER JOIN products p ON p.id = ci.product_id
       LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = TRUE
       WHERE ci.cart_id = ?
       ORDER BY ci.id ASC`,
      [cartId],
    );
    return (rows as mysql.RowDataPacket[]).map(mapCartItemWithProduct);
  }

  async findByCartAndProduct(cartId: string, productId: string): Promise<CartItem | null> {
    const [rows] = await this.pool.query(
      'SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ?',
      [cartId, productId],
    );
    const results = rows as mysql.RowDataPacket[];
    return results.length > 0 ? mapCartItem(results[0]) : null;
  }

  async create(data: CreateCartItemData & { id: string }): Promise<CartItem> {
    await this.pool.query(
      `INSERT INTO cart_items (id, cart_id, product_id, quantity, price_snapshot)
       VALUES (?, ?, ?, ?, ?)`,
      [data.id, data.cart_id, data.product_id, data.quantity, data.price_snapshot],
    );
    const created = await this.findById(data.id);
    if (!created) {
      throw new Error(`Failed to find created cart item with id: ${data.id}`);
    }
    return created;
  }

  async updateQuantity(id: string, quantity: number): Promise<CartItem> {
    await this.pool.query('UPDATE cart_items SET quantity = ? WHERE id = ?', [quantity, id]);
    const updated = await this.findById(id);
    if (!updated) {
      throw new Error(`Failed to find updated cart item with id: ${id}`);
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM cart_items WHERE id = ?', [id]);
  }

  async deleteByCartId(cartId: string, connection?: PoolConnection): Promise<void> {
    const db = connection ?? this.pool;
    await db.query('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);
  }
}
