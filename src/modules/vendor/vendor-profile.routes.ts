import { Router } from 'express';
import type { z } from 'zod';
import { getPool } from '@shared/utils/db';
import { AppError } from '@shared/errors/app-error';
import { validate } from '@shared/middlewares/validate';
import { UserRepository } from '@modules/auth/user.repository';
import { uploadImage } from '@shared/utils/cloudinary.util';
import { UpdateVendorProfileSchema } from './vendor-profile.schema';

const router = Router();
const userRepository = new UserRepository();

type ProfileRow = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: string;
  shop_name: string;
  shop_description: string | null;
  status: string;
  followers_count: number;
  following_count: number;
};

function toCount(value: unknown): number {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') return Number.parseInt(value, 10) || 0;
  return 0;
}

function mapProfileRow(row: ProfileRow) {
  return {
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
    avatar_url: row.avatar_url,
    shop_name: row.shop_name,
    shop_description: row.shop_description,
    followers_count: toCount(row.followers_count),
    following_count: toCount(row.following_count),
    id: row.id,
    role: row.role,
    status: row.status,
  };
}

async function fetchProfileRow(userId: string): Promise<ProfileRow | null> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar_url, u.role,
            v.shop_name, v.shop_description, v.status,
            (SELECT COUNT(*) FROM vendor_follows f WHERE f.vendor_id = v.id) AS followers_count,
            (SELECT COUNT(*) FROM vendor_follows f WHERE f.follower_id = v.user_id) AS following_count
     FROM users u
     INNER JOIN vendors v ON v.user_id = u.id
     WHERE u.id = ?`,
    [userId],
  );

  const results = rows as ProfileRow[];
  return results[0] ?? null;
}

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

    const row = await fetchProfileRow(userId);
    if (!row) {
      next(new AppError(404, 'VENDOR_NOT_FOUND', 'Vendor profile not found'));
      return;
    }

    res.json({ data: mapProfileRow(row) });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/vendor/profile
 */
router.patch('/', validate(UpdateVendorProfileSchema), async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      next(new AppError(401, 'UNAUTHORIZED', 'No token provided'));
      return;
    }

    const body = req.body as z.infer<typeof UpdateVendorProfileSchema>;
    const pool = getPool();

    const userUpdates: {
      first_name?: string;
      last_name?: string;
      phone?: string | null;
      avatar_url?: string | null;
    } = {};

    if (body.first_name !== undefined) userUpdates.first_name = body.first_name;
    if (body.last_name !== undefined) userUpdates.last_name = body.last_name;
    if (body.phone !== undefined) userUpdates.phone = body.phone;

    if (body.avatar_url !== undefined) {
      const source = body.avatar_url.trim();
      if (!source) {
        userUpdates.avatar_url = null;
      } else if (source.startsWith('data:') || source.startsWith('http://') || source.startsWith('https://')) {
        userUpdates.avatar_url = source.startsWith('data:')
          ? await uploadImage(source, 'marketplace/avatars')
          : source;
      } else {
        next(new AppError(400, 'INVALID_AVATAR', 'Invalid avatar URL'));
        return;
      }
    }

    if (Object.keys(userUpdates).length > 0) {
      await userRepository.update(userId, userUpdates);
    }

    const vendorUpdates: string[] = [];
    const vendorParams: unknown[] = [];

    if (body.shop_name !== undefined) {
      vendorUpdates.push('shop_name = ?');
      vendorParams.push(body.shop_name);
    }
    if (body.shop_description !== undefined) {
      vendorUpdates.push('shop_description = ?');
      vendorParams.push(body.shop_description);
    }

    if (vendorUpdates.length > 0) {
      vendorParams.push(userId);
      await pool.query(
        `UPDATE vendors SET ${vendorUpdates.join(', ')} WHERE user_id = ?`,
        vendorParams,
      );
    }

    const row = await fetchProfileRow(userId);
    if (!row) {
      next(new AppError(404, 'VENDOR_NOT_FOUND', 'Vendor profile not found'));
      return;
    }

    res.json({ data: mapProfileRow(row) });
  } catch (err) {
    next(err);
  }
});

export default router;
