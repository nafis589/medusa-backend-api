import { getPool } from '@shared/utils/db';
import type mysql from 'mysql2/promise';

const PERIOD_DAYS = 30;
const TOP_PRODUCTS_DAYS = 7;

export interface FunnelStep {
  label: string;
  value: number;
  conversion_rate: number | null;
}

export interface TopProductRow {
  id: string;
  title: string;
  views_count: number;
  shop_name: string | null;
  orders_count: number;
}

export interface CartAbandonmentPoint {
  date: string;
  carts: number;
  orders: number;
  abandonment_rate: number | null;
}

export interface AdminStatsChartData {
  funnel: FunnelStep[];
  top_products: TopProductRow[];
  cart_abandonment: CartAbandonmentPoint[];
}

function conversionRate(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round((current / previous) * 1000) / 10;
}

function toDateKey(value: unknown): string {
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return str;
  return toDateKey(parsed);
}

function buildDateSeries(days: number): string[] {
  const keys: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    keys.push(`${y}-${m}-${day}`);
  }
  return keys;
}

export async function getAdminStatsChart(): Promise<AdminStatsChartData> {
  const db = getPool();
  const periodStart = `DATE_SUB(CURDATE(), INTERVAL ${PERIOD_DAYS - 1} DAY)`;
  const topStart = `DATE_SUB(CURDATE(), INTERVAL ${TOP_PRODUCTS_DAYS - 1} DAY)`;

  const [visitorRows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(DISTINCT visitor_key) AS value
     FROM (
       SELECT COALESCE(c.user_id, c.session_id) AS visitor_key
       FROM carts c
       WHERE c.updated_at >= ${periodStart}
         AND (c.user_id IS NOT NULL OR c.session_id IS NOT NULL)
       UNION
       SELECT o.buyer_id AS visitor_key
       FROM orders o
       WHERE o.created_at >= ${periodStart}
         AND o.status NOT IN ('CANCELLED', 'RETURNED')
     ) active_visitors`,
  );

  const [productEngagementRows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(DISTINCT product_id) AS value
     FROM (
       SELECT ci.product_id
       FROM cart_items ci
       INNER JOIN carts c ON c.id = ci.cart_id
       WHERE c.updated_at >= ${periodStart}
       UNION
       SELECT oi.product_id
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id
       WHERE o.created_at >= ${periodStart}
         AND o.status NOT IN ('CANCELLED', 'RETURNED')
     ) engaged_products`,
  );

  const [cartAddsRows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT
       COALESCE((
         SELECT SUM(oi.quantity)
         FROM order_items oi
         INNER JOIN orders o ON o.id = oi.order_id
         WHERE o.created_at >= ${periodStart}
           AND o.status NOT IN ('CANCELLED', 'RETURNED')
       ), 0)
       +
       COALESCE((
         SELECT SUM(ci.quantity)
         FROM cart_items ci
         INNER JOIN carts c ON c.id = ci.cart_id
         WHERE c.updated_at >= ${periodStart}
       ), 0) AS value`,
  );

  const [ordersRows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS value
     FROM orders
     WHERE created_at >= ${periodStart}
       AND status NOT IN ('CANCELLED', 'RETURNED')`,
  );

  const visitors = Number(visitorRows[0]?.value ?? 0);
  const productEngagements = Number(productEngagementRows[0]?.value ?? 0);
  const cartAdds = Number(cartAddsRows[0]?.value ?? 0);
  const orders = Number(ordersRows[0]?.value ?? 0);

  const funnel: FunnelStep[] = [
    { label: 'Visiteurs', value: visitors, conversion_rate: null },
    {
      label: 'Produits engagés',
      value: productEngagements,
      conversion_rate: conversionRate(productEngagements, visitors),
    },
    {
      label: 'Articles panier',
      value: cartAdds,
      conversion_rate: conversionRate(cartAdds, productEngagements),
    },
    {
      label: 'Commandes',
      value: orders,
      conversion_rate: conversionRate(orders, cartAdds),
    },
  ];

  const [topProductRows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT p.id, p.title, p.views_count, v.shop_name,
            COALESCE(stats.orders_count, 0) AS orders_count,
            COALESCE(stats.units_sold, 0) AS units_sold
     FROM products p
     LEFT JOIN vendors v ON v.id = p.vendor_id
     LEFT JOIN (
       SELECT oi.product_id,
              COUNT(DISTINCT oi.order_id) AS orders_count,
              SUM(oi.quantity) AS units_sold
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id
       WHERE o.created_at >= ${topStart}
         AND o.status NOT IN ('CANCELLED', 'RETURNED')
       GROUP BY oi.product_id
     ) stats ON stats.product_id = p.id
     WHERE p.status IN ('ACTIVE', 'SOLD')
       AND (COALESCE(stats.orders_count, 0) > 0 OR p.views_count > 0)
     ORDER BY COALESCE(stats.orders_count, 0) DESC,
              COALESCE(stats.units_sold, 0) DESC,
              p.views_count DESC
     LIMIT 10`,
  );

  const [cartDailyRows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT DATE_FORMAT(c.updated_at, '%Y-%m-%d') AS date,
            COUNT(DISTINCT c.id) AS carts
     FROM carts c
     INNER JOIN cart_items ci ON ci.cart_id = c.id
     WHERE c.updated_at >= ${periodStart}
     GROUP BY DATE_FORMAT(c.updated_at, '%Y-%m-%d')
     ORDER BY DATE_FORMAT(c.updated_at, '%Y-%m-%d') ASC`,
  );

  const [orderDailyRows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date,
            COUNT(*) AS orders
     FROM orders
     WHERE created_at >= ${periodStart}
       AND status NOT IN ('CANCELLED', 'RETURNED')
     GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
     ORDER BY DATE_FORMAT(created_at, '%Y-%m-%d') ASC`,
  );

  const cartsByDate = new Map<string, number>();
  for (const row of cartDailyRows) {
    cartsByDate.set(toDateKey(row.date), Number(row.carts ?? 0));
  }

  const ordersByDate = new Map<string, number>();
  for (const row of orderDailyRows) {
    ordersByDate.set(toDateKey(row.date), Number(row.orders ?? 0));
  }

  const cart_abandonment: CartAbandonmentPoint[] = buildDateSeries(PERIOD_DAYS).map((key) => {
    const carts = cartsByDate.get(key) ?? 0;
    const dayOrders = ordersByDate.get(key) ?? 0;
    const abandonment_rate =
      carts > 0
        ? Math.round((Math.max(0, carts - Math.min(dayOrders, carts)) / carts) * 1000) / 10
        : null;

    return {
      date: key,
      carts,
      orders: dayOrders,
      abandonment_rate,
    };
  });

  return {
    funnel,
    top_products: topProductRows.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      views_count: Number(row.views_count ?? 0),
      shop_name: row.shop_name != null ? String(row.shop_name) : null,
      orders_count: Number(row.orders_count ?? 0),
    })),
    cart_abandonment,
  };
}
