import { randomUUID } from 'crypto';
import { getPool } from '@shared/utils/db';
import { hashPassword } from '@shared/utils/hash';

export const DEMO_ADMIN_CREDENTIALS = {
  email: 'admin@marketplace.com',
  password: 'Admin123!',
  first_name: 'Admin',
  last_name: 'Marketplace',
} as const;

/**
 * Non-destructive seed:
 * - Upserts the admin user by email
 * - Always refreshes password hash to match DEMO_ADMIN_CREDENTIALS.password
 */
export async function seedAdminUser(): Promise<void> {
  const pool = getPool();
  const hashed = await hashPassword(DEMO_ADMIN_CREDENTIALS.password);

  // Ensure this user exists and is ADMIN (role enum: BUYER|VENDOR|ADMIN)
  await pool.query(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, role)
     VALUES (?, ?, ?, ?, ?, 'ADMIN')
     ON DUPLICATE KEY UPDATE
       password_hash = VALUES(password_hash),
       first_name = VALUES(first_name),
       last_name = VALUES(last_name),
       role = 'ADMIN'`,
    [
      randomUUID(),
      DEMO_ADMIN_CREDENTIALS.email,
      hashed,
      DEMO_ADMIN_CREDENTIALS.first_name,
      DEMO_ADMIN_CREDENTIALS.last_name,
    ],
  );
}

