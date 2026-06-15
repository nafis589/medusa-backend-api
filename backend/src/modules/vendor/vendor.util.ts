import { getPool } from '@shared/utils/db';
import { AppError } from '@shared/errors/app-error';

export interface VendorRecord {
  id: string;
  status: string;
  shop_name: string;
}

export async function getVendorByUserId(userId: string): Promise<VendorRecord> {
  const pool = getPool();
  const [rows] = await pool.query(
    'SELECT id, status, shop_name FROM vendors WHERE user_id = ?',
    [userId],
  );
  const vendors = rows as VendorRecord[];
  if (vendors.length === 0) {
    throw new AppError(404, 'VENDOR_NOT_FOUND', 'Vendor not found for this user');
  }
  return vendors[0];
}

export async function getVendorIdByUserId(userId: string): Promise<string> {
  const vendor = await getVendorByUserId(userId);
  return vendor.id;
}

export async function getActiveVendorIdByUserId(userId: string): Promise<string> {
  const vendor = await getVendorByUserId(userId);
  if (vendor.status !== 'ACTIVE') {
    throw new AppError(403, 'VENDOR_NOT_ACTIVE', 'Vendor account must be ACTIVE to perform this action');
  }
  return vendor.id;
}
