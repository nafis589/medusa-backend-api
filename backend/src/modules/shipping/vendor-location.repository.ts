import type { IVendorLocationRepository } from './vendor-location.repository.interface';
import type {
  VendorLocation,
  CreateVendorLocationData,
  UpdateVendorLocationData,
} from './vendor-location.entity';
import { getPool } from '@shared/utils/db';
import type mysql from 'mysql2/promise';

function mapRow(row: VendorLocation): VendorLocation {
  return {
    ...row,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    is_valid: Boolean(row.is_valid),
  };
}

export class VendorLocationRepository implements IVendorLocationRepository {
  private get pool(): mysql.Pool {
    return getPool();
  }

  async findByVendorId(vendorId: string): Promise<VendorLocation | null> {
    const [rows] = await this.pool.query(
      'SELECT * FROM vendor_locations WHERE vendor_id = ?',
      [vendorId],
    );
    const results = rows as VendorLocation[];
    return results.length > 0 ? mapRow(results[0]) : null;
  }

  async findById(id: string): Promise<VendorLocation | null> {
    const [rows] = await this.pool.query('SELECT * FROM vendor_locations WHERE id = ?', [id]);
    const results = rows as VendorLocation[];
    return results.length > 0 ? mapRow(results[0]) : null;
  }

  async create(data: CreateVendorLocationData & { id: string }): Promise<VendorLocation> {
    await this.pool.query(
      `INSERT INTO vendor_locations
        (id, vendor_id, latitude, longitude, region_id, address, city, is_valid)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.id,
        data.vendor_id,
        data.latitude,
        data.longitude,
        data.region_id,
        data.address ?? null,
        data.city ?? null,
        data.is_valid ?? false,
      ],
    );

    const created = await this.findById(data.id);
    if (!created) {
      throw new Error(`Failed to find created vendor location with id: ${data.id}`);
    }
    return created;
  }

  async update(vendorId: string, data: UpdateVendorLocationData): Promise<VendorLocation> {
    const fields: string[] = [];
    const params: unknown[] = [];

    for (const [key, value] of Object.entries(data) as [string, unknown][]) {
      if (value !== undefined) {
        fields.push(`\`${key}\` = ?`);
        params.push(value);
      }
    }

    if (fields.length > 0) {
      params.push(vendorId);
      await this.pool.query(
        `UPDATE vendor_locations SET ${fields.join(', ')} WHERE vendor_id = ?`,
        params,
      );
    }

    const updated = await this.findByVendorId(vendorId);
    if (!updated) {
      throw new Error(`Failed to find updated vendor location for vendor: ${vendorId}`);
    }
    return updated;
  }

  async upsert(data: CreateVendorLocationData & { id: string }): Promise<VendorLocation> {
    const existing = await this.findByVendorId(data.vendor_id);
    if (existing) {
      return this.update(data.vendor_id, {
        latitude: data.latitude,
        longitude: data.longitude,
        region_id: data.region_id,
        address: data.address,
        city: data.city,
        is_valid: data.is_valid,
      });
    }
    return this.create(data);
  }
}
