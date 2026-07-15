import { TOGO_REGIONS } from '@modules/shipping/togo-regions';
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
    offer_id: (row.offer_id as string | null) ?? null,
  };
}

function resolveVendorRegionName(regionId: string | null | undefined): string | null {
  if (!regionId) return null;
  return TOGO_REGIONS.find((r) => r.id === regionId)?.name ?? regionId;
}

function mapCartItemWithProduct(row: mysql.RowDataPacket): CartItemWithProduct {
  return {
    ...mapCartItem(row),
    product: {
      title: row.title as string,
      primary_image: (row.primary_image as string | null) ?? null,
      price: Number(row.price),
      status: row.status as ProductStatus,
      vendor: {
        id: row.vendor_id as string,
        shop_name: row.shop_name as string,
        total_sales: Number(row.vendor_total_sales ?? 0),
        active_products: Number(row.vendor_active_products ?? 0),
        region: resolveVendorRegionName(row.vendor_region_id as string | null),
      },
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
      `SELECT ci.*, p.title, p.price, p.status, pi.url AS primary_image,
              v.id AS vendor_id, v.shop_name, v.total_sales AS vendor_total_sales,
              vl.region_id AS vendor_region_id,
              (SELECT COUNT(*) FROM products p2
               WHERE p2.vendor_id = p.vendor_id AND p2.status = 'ACTIVE') AS vendor_active_products
       FROM cart_items ci
       INNER JOIN products p ON p.id = ci.product_id
       INNER JOIN vendors v ON v.id = p.vendor_id
       LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = TRUE
       LEFT JOIN vendor_locations vl ON vl.vendor_id = p.vendor_id
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
      `INSERT INTO cart_items (id, cart_id, product_id, quantity, price_snapshot, offer_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.id,
        data.cart_id,
        data.product_id,
        data.quantity,
        data.price_snapshot,
        data.offer_id ?? null,
      ],
    );
    const created = await this.findById(data.id);
    if (!created) {
      throw new Error(`Failed to find created cart item with id: ${data.id}`);
    }
    return created;
  }

  async upsertOfferItem(data: {
    id: string;
    cart_id: string;
    product_id: string;
    price_snapshot: number;
    offer_id: string;
  }): Promise<CartItem> {
    // One product per cart (uk_cart_product) — replace any existing line so the
    // accepted-offer price and offer link take precedence, quantity forced to 1.
    await this.pool.query(
      `INSERT INTO cart_items (id, cart_id, product_id, quantity, price_snapshot, offer_id)
       VALUES (?, ?, ?, 1, ?, ?)
       ON DUPLICATE KEY UPDATE
         quantity = 1,
         price_snapshot = VALUES(price_snapshot),
         offer_id = VALUES(offer_id)`,
      [data.id, data.cart_id, data.product_id, data.price_snapshot, data.offer_id],
    );

    const item = await this.findByCartAndProduct(data.cart_id, data.product_id);
    if (!item) {
      throw new Error(`Failed to upsert offer cart item for product: ${data.product_id}`);
    }
    return item;
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

  async deleteByIds(ids: string[], connection?: PoolConnection): Promise<void> {
    if (ids.length === 0) return;
    const db = connection ?? this.pool;
    await db.query(
      `DELETE FROM cart_items WHERE id IN (${ids.map(() => '?').join(', ')})`,
      ids,
    );
  }

  async deleteByCartId(cartId: string, connection?: PoolConnection): Promise<void> {
    const db = connection ?? this.pool;
    await db.query('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);
  }
}
