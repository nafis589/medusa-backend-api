import { randomUUID } from 'crypto';
import type mysql from 'mysql2/promise';
import { getPool } from '@shared/utils/db';
import { TOGO_REGIONS } from '@modules/shipping/togo-regions';

export interface VendorPublicProfile {
  id: string;
  shop_name: string;
  shop_logo: string | null;
  shop_banner: string | null;
  rating: number;
  total_sales: number;
  followers_count: number;
  following_count: number;
  member_since: string;
  region: string | null;
  description: string | null;
}

function resolveRegionName(regionId: string | null): string | null {
  if (!regionId) return null;
  return TOGO_REGIONS.find((r) => r.id === regionId)?.name ?? regionId;
}

export class VendorPublicRepository {
  private get pool(): mysql.Pool {
    return getPool();
  }

  async findPublicProfile(id: string): Promise<VendorPublicProfile | null> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
      `SELECT v.id, v.shop_name, v.shop_logo, v.shop_banner, v.shop_description AS description,
              v.rating, v.total_sales, v.created_at AS member_since, v.user_id,
              vl.region_id AS region_id,
              (SELECT COUNT(*) FROM vendor_follows f WHERE f.vendor_id = v.id) AS followers_count,
              (SELECT COUNT(*) FROM vendor_follows f WHERE f.follower_id = v.user_id) AS following_count
       FROM vendors v
       LEFT JOIN vendor_locations vl ON vl.vendor_id = v.id
       WHERE v.id = ? AND v.status = 'ACTIVE'`,
      [id],
    );
    const row = rows[0];
    if (!row) return null;

    const memberSince = row.member_since as Date | string | null;

    return {
      id: row.id as string,
      shop_name: row.shop_name as string,
      shop_logo: (row.shop_logo as string | null) ?? null,
      shop_banner: (row.shop_banner as string | null) ?? null,
      rating: Number(row.rating),
      total_sales: Number(row.total_sales),
      followers_count: Number(row.followers_count),
      following_count: Number(row.following_count),
      member_since:
        memberSince instanceof Date ? memberSince.toISOString() : String(memberSince ?? ''),
      region: resolveRegionName((row.region_id as string | null) ?? null),
      description: (row.description as string | null) ?? null,
    };
  }

  /** Returns the vendor id if it exists and is ACTIVE, otherwise null. */
  async findActiveVendorId(id: string): Promise<string | null> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
      "SELECT id FROM vendors WHERE id = ? AND status = 'ACTIVE'",
      [id],
    );
    return (rows[0]?.id as string | undefined) ?? null;
  }

  async isFollowing(followerId: string, vendorId: string): Promise<boolean> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
      'SELECT 1 FROM vendor_follows WHERE follower_id = ? AND vendor_id = ? LIMIT 1',
      [followerId, vendorId],
    );
    return rows.length > 0;
  }

  async follow(followerId: string, vendorId: string): Promise<void> {
    await this.pool.query(
      'INSERT IGNORE INTO vendor_follows (id, follower_id, vendor_id) VALUES (?, ?, ?)',
      [randomUUID(), followerId, vendorId],
    );
  }

  async unfollow(followerId: string, vendorId: string): Promise<void> {
    await this.pool.query(
      'DELETE FROM vendor_follows WHERE follower_id = ? AND vendor_id = ?',
      [followerId, vendorId],
    );
  }

  async countFollowers(vendorId: string): Promise<number> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
      'SELECT COUNT(*) AS total FROM vendor_follows WHERE vendor_id = ?',
      [vendorId],
    );
    return Number(rows[0]?.total ?? 0);
  }
}
