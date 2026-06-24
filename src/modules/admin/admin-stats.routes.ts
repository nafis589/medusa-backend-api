import { Router } from 'express';
import { getPool } from '@shared/utils/db';
import type mysql from 'mysql2/promise';

import { getAdminStatsChart } from './admin-stats-chart';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const db = getPool();
    const [ordersTodayRows] = await db.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS value
       FROM orders
       WHERE DATE(created_at) = CURDATE()`,
    );
    const [revenueTodayRows] = await db.query<mysql.RowDataPacket[]>(
      `SELECT COALESCE(SUM(total_amount), 0) AS value
       FROM orders
       WHERE DATE(created_at) = CURDATE()`,
    );
    const [pendingVendorsRows] = await db.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS value FROM vendors WHERE status = 'PENDING'`,
    );
    const [activeUsersRows] = await db.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS value FROM users WHERE role IN ('BUYER', 'VENDOR')`,
    );
    const [revenue30Rows] = await db.query<mysql.RowDataPacket[]>(
      `SELECT DATE(created_at) AS date, COALESCE(SUM(total_amount), 0) AS amount
       FROM orders
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at) ASC`,
    );
    const [statusRows] = await db.query<mysql.RowDataPacket[]>(
      `SELECT status, COUNT(*) AS count
       FROM orders
       GROUP BY status
       ORDER BY count DESC`,
    );
    const [recentVendorRows] = await db.query<mysql.RowDataPacket[]>(
      `SELECT v.id, v.shop_name, u.email, vl.region_id AS region, v.status, v.created_at
       FROM vendors v
       INNER JOIN users u ON u.id = v.user_id
       LEFT JOIN vendor_locations vl ON vl.vendor_id = v.id
       ORDER BY v.created_at DESC
       LIMIT 5`,
    );

    res.json({
      data: {
        orders_today: Number(ordersTodayRows[0]?.value ?? 0),
        revenue_today: Number(revenueTodayRows[0]?.value ?? 0),
        pending_vendors: Number(pendingVendorsRows[0]?.value ?? 0),
        active_users: Number(activeUsersRows[0]?.value ?? 0),
        revenue_30d: revenue30Rows.map((r) => ({
          date: String(r.date),
          amount: Number(r.amount ?? 0),
        })),
        orders_by_status: statusRows.map((r) => ({
          status: String(r.status),
          count: Number(r.count ?? 0),
        })),
        recent_vendors: recentVendorRows.map((r) => ({
          id: String(r.id),
          shop_name: String(r.shop_name),
          email: String(r.email),
          region: (r.region as string | null) ?? null,
          status: String(r.status),
          created_at: String(r.created_at),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/chart', async (_req, res, next) => {
  try {
    const data = await getAdminStatsChart();
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

export default router;

