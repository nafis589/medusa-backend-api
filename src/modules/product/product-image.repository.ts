import { getPool } from '@shared/utils/db';
import type mysql from 'mysql2/promise';
import type { CreateProductImageData, ProductImage } from './product-image.entity';
import type { IProductImageRepository } from './product-image.repository.interface';

function mapRow(row: mysql.RowDataPacket): ProductImage {
  return {
    id: row.id as string,
    product_id: row.product_id as string,
    url: row.url as string,
    position: Number(row.position),
    is_primary: Boolean(row.is_primary),
  };
}

export class ProductImageRepository implements IProductImageRepository {
  private get pool(): mysql.Pool {
    return getPool();
  }

  async findByProductId(productId: string): Promise<ProductImage[]> {
    const [rows] = await this.pool.query(
      'SELECT * FROM product_images WHERE product_id = ? ORDER BY position ASC, is_primary DESC',
      [productId],
    );
    return (rows as mysql.RowDataPacket[]).map(mapRow);
  }

  async create(data: CreateProductImageData & { id: string }): Promise<ProductImage> {
    await this.pool.query(
      'INSERT INTO product_images (id, product_id, url, position, is_primary) VALUES (?, ?, ?, ?, ?)',
      [data.id, data.product_id, data.url, data.position ?? 0, data.is_primary ?? false],
    );

    const [rows] = await this.pool.query('SELECT * FROM product_images WHERE id = ?', [data.id]);
    const results = rows as mysql.RowDataPacket[];
    if (results.length === 0) {
      throw new Error(`Failed to find created product image with id: ${data.id}`);
    }
    return mapRow(results[0]);
  }

  async createMany(images: (CreateProductImageData & { id: string })[]): Promise<ProductImage[]> {
    if (images.length === 0) return [];

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const image of images) {
        await connection.query(
          'INSERT INTO product_images (id, product_id, url, position, is_primary) VALUES (?, ?, ?, ?, ?)',
          [
            image.id,
            image.product_id,
            image.url,
            image.position ?? 0,
            image.is_primary ?? false,
          ],
        );
      }
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    return this.findByProductId(images[0].product_id);
  }

  async deleteByProductId(productId: string): Promise<void> {
    await this.pool.query('DELETE FROM product_images WHERE product_id = ?', [productId]);
  }
}
