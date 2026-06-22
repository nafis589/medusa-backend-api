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

/**
 * Returns the vendor id for a user, or null if the user is not a vendor.
 * Does not throw — safe to use in buyer/guest contexts.
 */
export async function findVendorIdByUserId(userId: string): Promise<string | null> {
  const pool = getPool();
  const [rows] = await pool.query('SELECT id FROM vendors WHERE user_id = ?', [userId]);
  const vendors = rows as { id: string }[];
  return vendors[0]?.id ?? null;
}

/** Returns the owning user id for a vendor, or null if the vendor doesn't exist. */
export async function getUserIdByVendorId(vendorId: string): Promise<string | null> {
  const pool = getPool();
  const [rows] = await pool.query('SELECT user_id FROM vendors WHERE id = ?', [vendorId]);
  const vendors = rows as { user_id: string }[];
  return vendors[0]?.user_id ?? null;
}

export async function getActiveVendorIdByUserId(userId: string): Promise<string> {
  const vendor = await getVendorByUserId(userId);
  if (vendor.status !== 'ACTIVE') {
    throw new AppError(403, 'VENDOR_NOT_ACTIVE', 'Vendor account must be ACTIVE to perform this action');
  }
  return vendor.id;
}
