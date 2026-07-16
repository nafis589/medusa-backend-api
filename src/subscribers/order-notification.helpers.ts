import { getPool } from '@shared/utils/db';
import type { OrderStatus } from '@modules/order/order.types';

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  PREPARING: 'En préparation',
  SHIPPED: 'Expédiée',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
  RETURNED: 'Retournée',
  REFUSED: 'Refusée',
};

export function formatFcfa(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} FCFA`;
}

export function formatOrderRef(orderId: string): string {
  return `CMD-${orderId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

export function formatOrderStatus(status: OrderStatus): string {
  return STATUS_LABELS[status];
}

export async function getVendorUserId(vendorId: string): Promise<string | null> {
  const pool = getPool();
  const [rows] = await pool.query('SELECT user_id FROM vendors WHERE id = ?', [vendorId]);
  const results = rows as Array<{ user_id: string }>;
  return results[0]?.user_id ?? null;
}

export async function getBuyerDisplayName(buyerId: string): Promise<string> {
  const pool = getPool();
  const [rows] = await pool.query(
    'SELECT first_name, last_name FROM users WHERE id = ?',
    [buyerId],
  );
  const results = rows as Array<{ first_name: string; last_name: string }>;
  if (results.length === 0) return 'Un client';
  const user = results[0];
  return `${user.first_name} ${user.last_name}`.trim();
}

export async function getProductPrimaryImage(productId: string): Promise<string | null> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT url FROM product_images
     WHERE product_id = ?
     ORDER BY is_primary DESC, position ASC
     LIMIT 1`,
    [productId],
  );
  const results = rows as Array<{ url: string }>;
  return results[0]?.url ?? null;
}
