import { getPool } from '@shared/utils/db';
import type mysql from 'mysql2/promise';

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
  abandonment_rate: number;
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

export async function getAdminStatsChart(): Promise<AdminStatsChartData> {
  const db = getPool();

  const [visitorRows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(DISTINCT COALESCE(user_id, session_id)) AS value
     FROM carts
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
  );
  const [viewsRows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT COALESCE(SUM(views_count), 0) AS value FROM products`,
  );
  const [cartAddsRows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS value FROM cart_items`,
  );
  const [ordersRows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS value
     FROM orders
     WHERE status NOT IN ('CANCELLED', 'RETURNED')`,
  );

  const visitors = Number(visitorRows[0]?.value ?? 0);
  const productViews = Number(viewsRows[0]?.value ?? 0);
  const cartAdds = Number(cartAddsRows[0]?.value ?? 0);
  const orders = Number(ordersRows[0]?.value ?? 0);

  const funnel: FunnelStep[] = [
    { label: 'Visiteurs', value: visitors, conversion_rate: null },
    {
      label: 'Vues produit',
      value: productViews,
      conversion_rate: conversionRate(productViews, visitors),
    },
    {
      label: 'Ajouts panier',
      value: cartAdds,
      conversion_rate: conversionRate(cartAdds, productViews),
    },
    {
      label: 'Commandes',
      value: orders,
      conversion_rate: conversionRate(orders, cartAdds),
    },
  ];

  const [topProductRows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT p.id, p.title, p.views_count, v.shop_name,
            (SELECT COUNT(*) FROM order_items oi
             INNER JOIN orders o ON o.id = oi.order_id
             WHERE oi.product_id = p.id
               AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
               AND o.status NOT IN ('CANCELLED', 'RETURNED')) AS orders_count
     FROM products p
     LEFT JOIN vendors v ON v.id = p.vendor_id
     WHERE p.status = 'ACTIVE'
     ORDER BY p.views_count DESC, orders_count DESC
     LIMIT 10`,
  );

  const [cartDailyRows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT DATE(created_at) AS date, COUNT(*) AS carts
     FROM carts
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
     GROUP BY DATE(created_at)
     ORDER BY DATE(created_at) ASC`,
  );
  const [orderDailyRows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT DATE(created_at) AS date, COUNT(*) AS orders
     FROM orders
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
       AND status NOT IN ('CANCELLED', 'RETURNED')
     GROUP BY DATE(created_at)
     ORDER BY DATE(created_at) ASC`,
  );

  const cartsByDate = new Map<string, number>();
  for (const row of cartDailyRows) {
    cartsByDate.set(String(row.date), Number(row.carts ?? 0));
  }
  const ordersByDate = new Map<string, number>();
  for (const row of orderDailyRows) {
    ordersByDate.set(String(row.date), Number(row.orders ?? 0));
  }

  const cart_abandonment: CartAbandonmentPoint[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const carts = cartsByDate.get(key) ?? 0;
    const dayOrders = ordersByDate.get(key) ?? 0;
    const abandonment_rate =
      carts > 0 ? Math.round(((carts - dayOrders) / carts) * 1000) / 10 : 0;
    cart_abandonment.push({
      date: key,
      carts,
      orders: dayOrders,
      abandonment_rate: Math.max(0, abandonment_rate),
    });
  }

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
