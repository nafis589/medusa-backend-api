import mysql from 'mysql2/promise';
import { getPool } from '@shared/utils/db';
import type { CreateReviewData, Review } from './review.entity';
import type { IReviewRepository } from './review.repository.interface';

function mapReview(row: mysql.RowDataPacket): Review {
  return {
    id: row.id as string,
    product_id: row.product_id as string,
    buyer_id: row.buyer_id as string,
    order_id: row.order_id as string,
    rating: Number(row.rating),
    comment: (row.comment as string | null) ?? null,
    created_at: row.created_at as Date,
  };
}

export class ReviewRepository implements IReviewRepository {
  private get pool(): mysql.Pool {
    return getPool();
  }

  async findByBuyerAndProduct(buyerId: string, productId: string): Promise<Review | null> {
    const [rows] = await this.pool.query(
      'SELECT * FROM reviews WHERE buyer_id = ? AND product_id = ? LIMIT 1',
      [buyerId, productId],
    );
    const results = rows as mysql.RowDataPacket[];
    return results.length > 0 ? mapReview(results[0]) : null;
  }

  async create(data: CreateReviewData): Promise<Review> {
    await this.pool.query(
      `INSERT INTO reviews (id, product_id, buyer_id, order_id, rating, comment)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.id, data.product_id, data.buyer_id, data.order_id, data.rating, data.comment],
    );
    const [rows] = await this.pool.query('SELECT * FROM reviews WHERE id = ?', [data.id]);
    const results = rows as mysql.RowDataPacket[];
    if (results.length === 0) throw new Error('Failed to create review');
    return mapReview(results[0]);
  }

  async recalculateProductRating(productId: string): Promise<void> {
    await this.pool.query(
      `UPDATE products p
       SET rating_avg = COALESCE(
         (SELECT ROUND(AVG(r.rating), 2) FROM reviews r WHERE r.product_id = p.id),
         0
       )
       WHERE p.id = ?`,
      [productId],
    );
  }

  async recalculateVendorRating(vendorId: string): Promise<void> {
    await this.pool.query(
      `UPDATE vendors v
       SET rating = COALESCE(
         (
           SELECT ROUND(AVG(r.rating), 2)
           FROM reviews r
           INNER JOIN products p ON p.id = r.product_id
           WHERE p.vendor_id = v.id
         ),
         0
       )
       WHERE v.id = ?`,
      [vendorId],
    );
  }
}
