import { Router } from 'express';
import { UserRepository } from './user.repository';
import { authenticate } from '@shared/middlewares/authenticate';
import { AppError } from '@shared/errors/app-error';
import { findVendorIdByUserId } from '@modules/vendor/vendor.util';

const router = Router();
const userRepository = new UserRepository();

/**
 * GET /api/store/profile
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      next(new AppError(401, 'UNAUTHORIZED', 'No token provided'));
      return;
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      next(new AppError(404, 'USER_NOT_FOUND', 'User not found'));
      return;
    }

    const { password_hash: _, ...safeUser } = user;
    const vendorId = user.role === 'VENDOR' ? await findVendorIdByUserId(userId) : null;
    res.json({ data: { ...safeUser, vendorId } });
  } catch (err) {
    next(err);
  }
});

export default router;
