import { Router } from 'express';
import { getPool } from '@shared/utils/db';
import { AppError } from '@shared/errors/app-error';

const router = Router();

/**
 * GET /api/vendor/profile
 * Profil vendeur (user + boutique) pour le dashboard.
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      next(new AppError(401, 'UNAUTHORIZED', 'No token provided'));
      return;
    }

    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role,
              v.shop_name, v.status
       FROM users u
       INNER JOIN vendors v ON v.user_id = u.id
       WHERE u.id = ?`,
      [userId],
    );

    const results = rows as Array<{
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      role: string;
      shop_name: string;
      status: string;
    }>;

    if (results.length === 0) {
      next(new AppError(404, 'VENDOR_NOT_FOUND', 'Vendor profile not found'));
      return;
    }

    const row = results[0];
    res.json({
      data: {
        id: row.id,
        email: row.email,
        first_name: row.first_name,
        last_name: row.last_name,
        role: row.role,
        shop_name: row.shop_name,
        status: row.status,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
