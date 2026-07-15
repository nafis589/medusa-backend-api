import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { getPool } from '@shared/utils/db';
import { AppError } from '@shared/errors/app-error';
import { validate, validateParams, validateQuery } from '@shared/middlewares/validate';
import { getPagination, getPaginationMeta } from '@shared/utils/pagination';
import type mysql from 'mysql2/promise';

const router = Router();
const db = getPool();

const UserListQuerySchema = z.object({
  role: z.enum(['BUYER', 'VENDOR']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  search: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25).optional(),
});

const UserIdSchema = z.object({
  id: z.string().uuid('User id must be a valid UUID'),
});

const UserOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10).optional(),
});

const SuspendUserSchema = z.object({
  reason: z.string().max(1000).optional(),
});

function mapUserRow(r: mysql.RowDataPacket) {
  return {
    id: String(r.id),
    email: String(r.email),
    first_name: String(r.first_name),
    last_name: String(r.last_name),
    role: String(r.role) as 'BUYER' | 'VENDOR',
    status: String(r.status ?? 'ACTIVE') as 'ACTIVE' | 'SUSPENDED',
    phone: (r.phone as string | null) ?? null,
    created_at: String(r.created_at),
    last_login_at: r.last_login_at ? String(r.last_login_at) : null,
    vendor_id: (r.vendor_id as string | null) ?? null,
    orders_count: Number(r.orders_count ?? 0),
    active_products_count: Number(r.active_products_count ?? 0),
  };
}

async function logAdminAction(
  userId: string,
  adminId: string,
  action: string,
  reason?: string | null,
): Promise<void> {
  await db.query(
    `INSERT INTO admin_user_actions (id, user_id, admin_id, action, reason) VALUES (?, ?, ?, ?, ?)`,
    [randomUUID(), userId, adminId, action, reason ?? null],
  );
}

async function fetchActionsHistory(userId: string) {
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT a.id, a.action, a.reason, a.created_at,
            CONCAT(admin.first_name, ' ', admin.last_name) AS admin_name,
            admin.email AS admin_email
     FROM admin_user_actions a
     INNER JOIN users admin ON admin.id = a.admin_id
     WHERE a.user_id = ?
     ORDER BY a.created_at DESC
     LIMIT 50`,
    [userId],
  );
  return rows.map((r) => ({
    id: String(r.id),
    action: String(r.action),
    reason: (r.reason as string | null) ?? null,
    admin_name: String(r.admin_name).trim(),
    admin_email: String(r.admin_email),
    created_at: String(r.created_at),
  }));
}

router.get('/', validateQuery(UserListQuerySchema), async (req, res, next) => {
  try {
    const query = req.query as z.infer<typeof UserListQuerySchema>;
    const page = query.page ?? 1;
    const { offset, limit } = getPagination(page, query.limit ?? 25);

    const conditions: string[] = ["u.role IN ('BUYER', 'VENDOR')"];
    const params: unknown[] = [];

    if (query.role) {
      conditions.push('u.role = ?');
      params.push(query.role);
    }
    if (query.status) {
      conditions.push('u.status = ?');
      params.push(query.status);
    }
    if (query.search?.trim()) {
      conditions.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)');
      const term = `%${query.search.trim()}%`;
      params.push(term, term, term);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [countRows] = await db.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM users u ${where}`,
      params,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const [rows] = await db.query<mysql.RowDataPacket[]>(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.status, u.phone,
              u.created_at, u.last_login_at,
              v.id AS vendor_id,
              (SELECT COUNT(*) FROM orders o WHERE o.buyer_id = u.id) AS orders_count,
              (SELECT COUNT(*) FROM products p
               INNER JOIN vendors v2 ON v2.id = p.vendor_id
               WHERE v2.user_id = u.id AND p.status = 'ACTIVE') AS active_products_count
       FROM users u
       LEFT JOIN vendors v ON v.user_id = u.id
       ${where}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    res.json({
      data: rows.map(mapUserRow),
      meta: getPaginationMeta(total, page, limit),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/orders', validateParams(UserIdSchema), validateQuery(UserOrdersQuerySchema), async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const query = req.query as z.infer<typeof UserOrdersQuerySchema>;
    const page = query.page ?? 1;
    const { offset, limit } = getPagination(page, query.limit ?? 10);

    const [userRows] = await db.query<mysql.RowDataPacket[]>(
      `SELECT id, role FROM users WHERE id = ? AND role = 'BUYER'`,
      [id],
    );
    if (!userRows.length) throw AppError.notFound('User');

    const [countRows] = await db.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM orders WHERE buyer_id = ?`,
      [id],
    );
    const total = Number(countRows[0]?.total ?? 0);

    const [rows] = await db.query<mysql.RowDataPacket[]>(
      `SELECT id, status, total_amount, created_at
       FROM orders
       WHERE buyer_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [id, limit, offset],
    );

    res.json({
      data: rows.map((r) => ({
        id: String(r.id),
        status: String(r.status),
        total_amount: Number(r.total_amount),
        created_at: String(r.created_at),
      })),
      meta: getPaginationMeta(total, page, limit),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', validateParams(UserIdSchema), async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const [rows] = await db.query<mysql.RowDataPacket[]>(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.status, u.phone,
              u.created_at, u.last_login_at,
              v.id AS vendor_id, v.shop_name,
              (SELECT COUNT(*) FROM orders o WHERE o.buyer_id = u.id) AS orders_count,
              (SELECT COUNT(*) FROM products p
               INNER JOIN vendors v2 ON v2.id = p.vendor_id
               WHERE v2.user_id = u.id AND p.status = 'ACTIVE') AS active_products_count,
              (SELECT COUNT(*) FROM orders o2
               INNER JOIN vendors v3 ON v3.id = o2.vendor_id
               WHERE v3.user_id = u.id) AS vendor_orders_count,
              (SELECT COALESCE(SUM(o3.total_amount), 0) FROM orders o3
               INNER JOIN vendors v4 ON v4.id = o3.vendor_id
               WHERE v4.user_id = u.id AND o3.status = 'DELIVERED') AS vendor_revenue
       FROM users u
       LEFT JOIN vendors v ON v.user_id = u.id
       WHERE u.id = ? AND u.role IN ('BUYER', 'VENDOR')`,
      [id],
    );
    if (!rows.length) throw AppError.notFound('User');

    const r = rows[0];
    const actions_history = await fetchActionsHistory(id);

    res.json({
      data: {
        ...mapUserRow(r),
        shop_name: (r.shop_name as string | null) ?? null,
        vendor_orders_count: Number(r.vendor_orders_count ?? 0),
        vendor_revenue: Number(r.vendor_revenue ?? 0),
        actions_history,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/:id/suspend',
  validateParams(UserIdSchema),
  validate(SuspendUserSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params as { id: string };
      const { reason } = req.body as z.infer<typeof SuspendUserSchema>;
      const adminId = req.user?.id;
      if (!adminId) throw new AppError(401, 'UNAUTHORIZED', 'No token provided');

      const [rows] = await db.query<mysql.RowDataPacket[]>(
        `SELECT id, role FROM users WHERE id = ? AND role IN ('BUYER', 'VENDOR')`,
        [id],
      );
      if (!rows.length) throw AppError.notFound('User');

      await db.query(`UPDATE users SET status = 'SUSPENDED' WHERE id = ?`, [id]);
      await db.query(`UPDATE vendors SET status = 'SUSPENDED' WHERE user_id = ?`, [id]);
      await logAdminAction(id, adminId, 'SUSPEND', reason);

      const [updated] = await db.query<mysql.RowDataPacket[]>(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.status, u.phone,
                u.created_at, u.last_login_at, v.id AS vendor_id,
                (SELECT COUNT(*) FROM orders o WHERE o.buyer_id = u.id) AS orders_count,
                (SELECT COUNT(*) FROM products p
                 INNER JOIN vendors v2 ON v2.id = p.vendor_id
                 WHERE v2.user_id = u.id AND p.status = 'ACTIVE') AS active_products_count
         FROM users u
         LEFT JOIN vendors v ON v.user_id = u.id
         WHERE u.id = ?`,
        [id],
      );

      res.json({ data: mapUserRow(updated[0]) });
    } catch (err) {
      next(err);
    }
  },
);

router.patch('/:id/activate', validateParams(UserIdSchema), async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const adminId = req.user?.id;
    if (!adminId) throw new AppError(401, 'UNAUTHORIZED', 'No token provided');

    const [rows] = await db.query<mysql.RowDataPacket[]>(
      `SELECT id, role FROM users WHERE id = ? AND role IN ('BUYER', 'VENDOR')`,
      [id],
    );
    if (!rows.length) throw AppError.notFound('User');

    await db.query(`UPDATE users SET status = 'ACTIVE' WHERE id = ?`, [id]);
    await db.query(
      `UPDATE vendors SET status = 'ACTIVE' WHERE user_id = ? AND status = 'SUSPENDED'`,
      [id],
    );
    await logAdminAction(id, adminId, 'ACTIVATE');

    const [updated] = await db.query<mysql.RowDataPacket[]>(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.status, u.phone,
              u.created_at, u.last_login_at, v.id AS vendor_id,
              (SELECT COUNT(*) FROM orders o WHERE o.buyer_id = u.id) AS orders_count,
              (SELECT COUNT(*) FROM products p
               INNER JOIN vendors v2 ON v2.id = p.vendor_id
               WHERE v2.user_id = u.id AND p.status = 'ACTIVE') AS active_products_count
       FROM users u
       LEFT JOIN vendors v ON v.user_id = u.id
       WHERE u.id = ?`,
      [id],
    );

    res.json({ data: mapUserRow(updated[0]) });
  } catch (err) {
    next(err);
  }
});

export default router;
