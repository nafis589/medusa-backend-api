import type { IVendorShippingRegionRepository } from './vendor-shipping-region.repository.interface';
import type {
  VendorShippingRegion,
  CreateVendorShippingRegionData,
} from './vendor-shipping-region.entity';
import { getPool } from '@shared/utils/db';
import type mysql from 'mysql2/promise';

function mapRow(row: VendorShippingRegion): VendorShippingRegion {
  return {
    ...row,
    is_home_region: Boolean(row.is_home_region),
    price_per_km: row.price_per_km != null ? Number(row.price_per_km) : null,
    min_fee: Number(row.min_fee),
    fixed_price: row.fixed_price != null ? Number(row.fixed_price) : null,
  };
}

export class VendorShippingRegionRepository implements IVendorShippingRegionRepository {
  private get pool(): mysql.Pool {
    return getPool();
  }

  async findByVendorId(vendorId: string): Promise<VendorShippingRegion[]> {
    const [rows] = await this.pool.query(
      'SELECT * FROM vendor_shipping_regions WHERE vendor_id = ? ORDER BY is_home_region DESC, region_id ASC',
      [vendorId],
    );
    return (rows as VendorShippingRegion[]).map(mapRow);
  }

  async findByVendorAndRegion(
    vendorId: string,
    regionId: string,
  ): Promise<VendorShippingRegion | null> {
    const [rows] = await this.pool.query(
      'SELECT * FROM vendor_shipping_regions WHERE vendor_id = ? AND region_id = ?',
      [vendorId, regionId],
    );
    const results = rows as VendorShippingRegion[];
    return results.length > 0 ? mapRow(results[0]) : null;
  }

  async create(
    data: CreateVendorShippingRegionData & { id: string },
  ): Promise<VendorShippingRegion> {
    await this.pool.query(
      `INSERT INTO vendor_shipping_regions
        (id, vendor_id, region_id, is_home_region, price_per_km, min_fee, fixed_price)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.id,
        data.vendor_id,
        data.region_id,
        data.is_home_region ?? false,
        data.price_per_km ?? null,
        data.min_fee ?? 500,
        data.fixed_price ?? null,
      ],
    );

    const created = await this.findByVendorAndRegion(data.vendor_id, data.region_id);
    if (!created) {
      throw new Error(
        `Failed to find created vendor shipping region for vendor ${data.vendor_id}`,
      );
    }
    return created;
  }

  async deleteByVendorId(vendorId: string): Promise<void> {
    await this.pool.query('DELETE FROM vendor_shipping_regions WHERE vendor_id = ?', [vendorId]);
  }

  async replaceAllForVendor(
    vendorId: string,
    regions: Array<CreateVendorShippingRegionData & { id: string }>,
  ): Promise<VendorShippingRegion[]> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('DELETE FROM vendor_shipping_regions WHERE vendor_id = ?', [
        vendorId,
      ]);

      for (const region of regions) {
        await connection.query(
          `INSERT INTO vendor_shipping_regions
            (id, vendor_id, region_id, is_home_region, price_per_km, min_fee, fixed_price)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            region.id,
            vendorId,
            region.region_id,
            region.is_home_region ?? false,
            region.price_per_km ?? null,
            region.min_fee ?? 500,
            region.fixed_price ?? null,
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

    return this.findByVendorId(vendorId);
  }
}
