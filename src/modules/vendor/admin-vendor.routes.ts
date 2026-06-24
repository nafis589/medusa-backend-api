import { Router } from 'express';
import { z } from 'zod';
import { getPool } from '@shared/utils/db';
import { AppError } from '@shared/errors/app-error';
import { validate, validateParams, validateQuery } from '@shared/middlewares/validate';
import type mysql from 'mysql2/promise';

const router = Router();
const db = getPool();

const VendorListQuerySchema = z.object({
  status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED']).optional(),
  search: z.string().min(1).optional(),
});

const VendorIdSchema = z.object({
  id: z.string().uuid('Vendor id must be a valid UUID'),
});

const VendorStatusUpdateSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
  reason: z.string().optional().nullable(),
});

router.get('/', validateQuery(VendorListQuerySchema), async (req, res, next) => {
  try {
    const { status, search } = req.query as z.infer<typeof VendorListQuerySchema>;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (status) {
      conditions.push('v.status = ?');
      params.push(status);
    }
    if (search?.trim()) {
      conditions.push('(v.shop_name LIKE ? OR u.email LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await db.query<mysql.RowDataPacket[]>(
      `SELECT v.id, v.shop_name, v.shop_logo AS logo_url, v.status, v.rating, v.created_at,
              u.email,
              vl.region_id AS region,
              (SELECT COUNT(*) FROM products p WHERE p.vendor_id = v.id) AS products_count,
              (SELECT COUNT(*) FROM orders o WHERE o.vendor_id = v.id) AS orders_count
       FROM vendors v
       INNER JOIN users u ON u.id = v.user_id
       LEFT JOIN vendor_locations vl ON vl.vendor_id = v.id
       ${where}
       ORDER BY v.created_at DESC`,
      params,
    );

    res.json({
      data: rows.map((r) => ({
        id: String(r.id),
        shop_name: String(r.shop_name),
        email: String(r.email),
        region: (r.region as string | null) ?? null,
        products_count: Number(r.products_count ?? 0),
        orders_count: Number(r.orders_count ?? 0),
        rating: r.rating === null ? null : Number(r.rating),
        status: String(r.status),
        created_at: String(r.created_at),
        logo_url: (r.logo_url as string | null) ?? null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', validateParams(VendorIdSchema), async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const [vendorRows] = await db.query<mysql.RowDataPacket[]>(
      `SELECT v.id, v.shop_name, v.shop_logo AS logo_url, v.status, v.rating, v.created_at,
              u.email, u.first_name, u.last_name, u.phone,
              vl.region_id AS region, vl.address, vl.latitude, vl.longitude,
              (SELECT COUNT(*) FROM products p WHERE p.vendor_id = v.id) AS products_count,
              (SELECT COUNT(*) FROM orders o WHERE o.vendor_id = v.id) AS orders_count
       FROM vendors v
       INNER JOIN users u ON u.id = v.user_id
       LEFT JOIN vendor_locations vl ON vl.vendor_id = v.id
       WHERE v.id = ?`,
      [id],
    );
    if (!vendorRows.length) throw AppError.notFound('Vendor');
    const v = vendorRows[0];

    const [productsRows] = await db.query<mysql.RowDataPacket[]>(
      `SELECT p.id, p.title, p.status, p.price,
              (SELECT pi.url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.position ASC LIMIT 1) AS image
       FROM products p
       WHERE p.vendor_id = ?
       ORDER BY p.created_at DESC
       LIMIT 20`,
      [id],
    );
    const [ordersRows] = await db.query<mysql.RowDataPacket[]>(
      `SELECT id, status, total_amount, created_at
       FROM orders
       WHERE vendor_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [id],
    );

    res.json({
      data: {
        id: String(v.id),
        shop_name: String(v.shop_name),
        email: String(v.email),
        region: (v.region as string | null) ?? null,
        products_count: Number(v.products_count ?? 0),
        orders_count: Number(v.orders_count ?? 0),
        rating: v.rating === null ? null : Number(v.rating),
        status: String(v.status),
        created_at: String(v.created_at),
        logo_url: (v.logo_url as string | null) ?? null,
        owner_name: `${String(v.first_name)} ${String(v.last_name)}`.trim(),
        phone: (v.phone as string | null) ?? null,
        address: (v.address as string | null) ?? null,
        latitude: v.latitude === null ? null : Number(v.latitude),
        longitude: v.longitude === null ? null : Number(v.longitude),
        products: productsRows.map((p) => ({
          id: String(p.id),
          title: String(p.title),
          status: String(p.status),
          price: Number(p.price),
          image: (p.image as string | null) ?? null,
        })),
        orders: ordersRows.map((o) => ({
          id: String(o.id),
          status: String(o.status),
          total_amount: Number(o.total_amount),
          created_at: String(o.created_at),
        })),
        actions_history: [] as unknown[],
      },
    });
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/:id/status',
  validateParams(VendorIdSchema),
  validate(VendorStatusUpdateSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params as { id: string };
      const { status } = req.body as z.infer<typeof VendorStatusUpdateSchema>;
      await db.query(`UPDATE vendors SET status = ? WHERE id = ?`, [status, id]);
      const [rows] = await db.query<mysql.RowDataPacket[]>(
        `SELECT v.id, v.shop_name, v.shop_logo AS logo_url, v.status, v.rating, v.created_at,
                u.email,
                vl.region_id AS region,
                (SELECT COUNT(*) FROM products p WHERE p.vendor_id = v.id) AS products_count,
                (SELECT COUNT(*) FROM orders o WHERE o.vendor_id = v.id) AS orders_count
         FROM vendors v
         INNER JOIN users u ON u.id = v.user_id
         LEFT JOIN vendor_locations vl ON vl.vendor_id = v.id
         WHERE v.id = ?`,
        [id],
      );
      if (!rows.length) throw AppError.notFound('Vendor');
      const r = rows[0];
      res.json({
        data: {
          id: String(r.id),
          shop_name: String(r.shop_name),
          email: String(r.email),
          region: (r.region as string | null) ?? null,
          products_count: Number(r.products_count ?? 0),
          orders_count: Number(r.orders_count ?? 0),
          rating: r.rating === null ? null : Number(r.rating),
          status: String(r.status),
          created_at: String(r.created_at),
          logo_url: (r.logo_url as string | null) ?? null,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;

