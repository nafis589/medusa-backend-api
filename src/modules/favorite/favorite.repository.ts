import mysql from 'mysql2/promise';
import { getPool } from '@shared/utils/db';
import type { CreateFavoriteData, Favorite, FavoriteProductRow } from './favorite.entity';
import type { IFavoriteRepository } from './favorite.repository.interface';

function mapFavorite(row: mysql.RowDataPacket): Favorite {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    product_id: row.product_id as string,
    created_at: row.created_at as Date,
  };
}

function mapFavoriteProduct(row: mysql.RowDataPacket): FavoriteProductRow {
  return {
    id: row.id as string,
    title: row.title as string,
    price: Number(row.price),
    brand: (row.brand as string | null) ?? null,
    size: (row.size as string | null) ?? null,
    condition: (row.condition as string | null) ?? null,
    status: row.status as string,
    primary_image: (row.primary_image as string | null) ?? null,
    shop_name: (row.shop_name as string | null) ?? null,
    vendor_region_id: (row.vendor_region_id as string | null) ?? null,
    favorited_at: row.favorited_at as Date,
  };
}

export class FavoriteRepository implements IFavoriteRepository {
  private get pool(): mysql.Pool {
    return getPool();
  }

  async findByUserAndProduct(userId: string, productId: string): Promise<Favorite | null> {
    const [rows] = await this.pool.query(
      'SELECT * FROM favorites WHERE user_id = ? AND product_id = ? LIMIT 1',
      [userId, productId],
    );
    const results = rows as mysql.RowDataPacket[];
    return results.length > 0 ? mapFavorite(results[0]) : null;
  }

  async listProductsForUser(userId: string): Promise<FavoriteProductRow[]> {
    const [rows] = await this.pool.query(
      `SELECT p.id, p.title, p.price, p.brand, p.size, p.\`condition\`, p.status,
              pi.url AS primary_image, v.shop_name, vl.region_id AS vendor_region_id,
              f.created_at AS favorited_at
       FROM favorites f
       INNER JOIN products p ON p.id = f.product_id
       LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = TRUE
       LEFT JOIN vendors v ON v.id = p.vendor_id
       LEFT JOIN vendor_locations vl ON vl.vendor_id = p.vendor_id
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC`,
      [userId],
    );
    return (rows as mysql.RowDataPacket[]).map(mapFavoriteProduct);
  }

  async create(data: CreateFavoriteData): Promise<Favorite> {
    await this.pool.query(
      'INSERT INTO favorites (id, user_id, product_id) VALUES (?, ?, ?)',
      [data.id, data.user_id, data.product_id],
    );
    const created = await this.findByUserAndProduct(data.user_id, data.product_id);
    if (!created) throw new Error('Failed to create favorite');
    return created;
  }

  async delete(userId: string, productId: string): Promise<boolean> {
    const [result] = await this.pool.query(
      'DELETE FROM favorites WHERE user_id = ? AND product_id = ?',
      [userId, productId],
    );
    return (result as mysql.ResultSetHeader).affectedRows > 0;
  }
}
