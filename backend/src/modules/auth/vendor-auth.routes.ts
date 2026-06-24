import { Router } from 'express';
import type { z } from 'zod';
import { randomUUID } from 'crypto';
import { AuthService } from './auth.service';
import { UserRepository } from './user.repository';
import { validate } from '@shared/middlewares/validate';
import { getPool } from '@shared/utils/db';
import { VendorRegisterSchema } from './auth.schema';

const router = Router();
const userRepository = new UserRepository();
const authService = new AuthService(userRepository);

/**
 * POST /api/vendor/auth/register
 */
router.post('/register', validate(VendorRegisterSchema), async (req, res, next) => {
  const pool = getPool();
  try {
    const { email, password, first_name, last_name, shop_name, shop_description } =
      req.body as z.infer<typeof VendorRegisterSchema>;

    // 1. Register User (role VENDOR)
    const result = await authService.register({
      email,
      password,
      first_name,
      last_name,
      role: 'VENDOR',
    });

    const { user } = result;

    // 2. Create Vendor entry
    try {
      const vendorId = randomUUID();
      await pool.query(
        'INSERT INTO vendors (id, user_id, shop_name, shop_description, status) VALUES (?, ?, ?, ?, ?)',
        [vendorId, user.id, shop_name, shop_description ?? null, 'PENDING'],
      );
    } catch (dbErr) {
      // Cleanup registered user on vendor insert failure to maintain consistency
      await pool.query('DELETE FROM users WHERE id = ?', [user.id]);
      throw dbErr;
    }

    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
