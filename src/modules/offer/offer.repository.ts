import mysql from 'mysql2/promise';
import { getPool } from '@shared/utils/db';
import type { CreateOfferData, Offer, OfferListRow, OfferStatus } from './offer.entity';
import type { IOfferRepository } from './offer.repository.interface';

function mapOffer(row: mysql.RowDataPacket): Offer {
  return {
    id: row.id as string,
    product_id: row.product_id as string,
    buyer_id: row.buyer_id as string,
    vendor_id: row.vendor_id as string,
    amount: Number(row.amount),
    status: row.status as OfferStatus,
    counter_amount: row.counter_amount != null ? Number(row.counter_amount) : null,
    expires_at: row.expires_at as Date,
    created_at: row.created_at as Date,
    updated_at: row.updated_at as Date,
    consumed_at: (row.consumed_at as Date | null) ?? null,
  };
}

function mapOfferListRow(row: mysql.RowDataPacket): OfferListRow {
  return {
    ...mapOffer(row),
    product_title: row.product_title as string,
    product_brand: (row.product_brand as string | null) ?? null,
    product_price: Number(row.product_price),
    product_image: (row.product_image as string | null) ?? null,
    shop_name: row.shop_name as string,
    buyer_name: (row.buyer_name as string)?.trim() || 'Client',
  };
}

const LIST_SELECT = `
  o.*,
  p.title AS product_title,
  p.brand AS product_brand,
  p.price AS product_price,
  pi.url AS product_image,
  v.shop_name,
  TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS buyer_name
`;

const LIST_JOINS = `
  FROM offers o
  INNER JOIN products p ON p.id = o.product_id
  INNER JOIN vendors v ON v.id = o.vendor_id
  INNER JOIN users u ON u.id = o.buyer_id
  LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = TRUE
`;

export class OfferRepository implements IOfferRepository {
  private get pool(): mysql.Pool {
    return getPool();
  }

  async findById(id: string): Promise<Offer | null> {
    const [rows] = await this.pool.query('SELECT * FROM offers WHERE id = ?', [id]);
    const results = rows as mysql.RowDataPacket[];
    return results.length > 0 ? mapOffer(results[0]) : null;
  }

  async findActiveByBuyerAndProduct(buyerId: string, productId: string): Promise<Offer | null> {
    const [rows] = await this.pool.query(
      `SELECT * FROM offers
       WHERE buyer_id = ? AND product_id = ?
         AND status IN ('PENDING', 'COUNTER')
         AND expires_at > NOW()
       LIMIT 1`,
      [buyerId, productId],
    );
    const results = rows as mysql.RowDataPacket[];
    return results.length > 0 ? mapOffer(results[0]) : null;
  }

  async create(data: CreateOfferData): Promise<Offer> {
    await this.pool.query(
      `INSERT INTO offers (id, product_id, buyer_id, vendor_id, amount, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.id, data.product_id, data.buyer_id, data.vendor_id, data.amount, data.expires_at],
    );
    const created = await this.findById(data.id);
    if (!created) throw new Error('Failed to create offer');
    return created;
  }

  async updateStatus(
    id: string,
    status: OfferStatus,
    fields?: { counter_amount?: number | null; amount?: number },
  ): Promise<Offer> {
    const sets = ['status = ?'];
    const params: unknown[] = [status];

    if (fields?.counter_amount !== undefined) {
      sets.push('counter_amount = ?');
      params.push(fields.counter_amount);
    }
    if (fields?.amount !== undefined) {
      sets.push('amount = ?');
      params.push(fields.amount);
    }

    params.push(id);
    await this.pool.query(`UPDATE offers SET ${sets.join(', ')} WHERE id = ?`, params);

    const updated = await this.findById(id);
    if (!updated) throw new Error('Offer not found after update');
    return updated;
  }

  async listByBuyer(buyerId: string): Promise<OfferListRow[]> {
    const [rows] = await this.pool.query(
      `SELECT ${LIST_SELECT} ${LIST_JOINS}
       WHERE o.buyer_id = ?
       ORDER BY o.created_at DESC`,
      [buyerId],
    );
    return (rows as mysql.RowDataPacket[]).map(mapOfferListRow);
  }

  async listByVendor(vendorId: string): Promise<OfferListRow[]> {
    const [rows] = await this.pool.query(
      `SELECT ${LIST_SELECT} ${LIST_JOINS}
       WHERE o.vendor_id = ?
       ORDER BY o.created_at DESC`,
      [vendorId],
    );
    return (rows as mysql.RowDataPacket[]).map(mapOfferListRow);
  }

  async listByVendorPaginated(
    vendorId: string,
    status: OfferStatus | undefined,
    offset: number,
    limit: number,
  ): Promise<{ rows: OfferListRow[]; total: number }> {
    const where = ['o.vendor_id = ?'];
    const params: unknown[] = [vendorId];

    if (status) {
      where.push('o.status = ?');
      params.push(status);
    }

    const whereClause = where.join(' AND ');

    const [countRows] = await this.pool.query(
      `SELECT COUNT(*) AS total ${LIST_JOINS} WHERE ${whereClause}`,
      params,
    );
    const total = Number((countRows as mysql.RowDataPacket[])[0]?.total ?? 0);

    const [rows] = await this.pool.query(
      `SELECT ${LIST_SELECT} ${LIST_JOINS}
       WHERE ${whereClause}
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return {
      rows: (rows as mysql.RowDataPacket[]).map(mapOfferListRow),
      total,
    };
  }

  async expireStale(): Promise<void> {
    await this.pool.query(
      `UPDATE offers SET status = 'EXPIRED'
       WHERE status IN ('PENDING', 'COUNTER') AND expires_at <= NOW()`,
    );
  }

  async markConsumed(id: string, connection?: mysql.PoolConnection): Promise<void> {
    const db = connection ?? this.pool;
    await db.query(
      'UPDATE offers SET consumed_at = NOW() WHERE id = ? AND consumed_at IS NULL',
      [id],
    );
  }
}
