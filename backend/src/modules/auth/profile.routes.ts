import { Router } from 'express';
import { UserRepository } from './user.repository';
import { authenticate } from '@shared/middlewares/authenticate';
import { AppError } from '@shared/errors/app-error';

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
    res.json({ data: safeUser });
  } catch (err) {
    next(err);
  }
});

export default router;
