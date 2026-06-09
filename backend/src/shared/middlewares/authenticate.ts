import type { Request, Response, NextFunction } from 'express';
import { AppError } from '@shared/errors/app-error';
import { verifyToken, type JwtPayload } from '@shared/utils/jwt.util';
import { getRedis } from '@shared/utils/redis';
import { logger } from '@shared/utils/logger';

// Extend Express Request with authenticated user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    next(new AppError(401, 'UNAUTHORIZED', 'No token provided'));
    return;
  }

  const token = authHeader.slice(7);

  try {
    // 1. Verify token
    const decoded = verifyToken(token);

    // 2. Check blacklist in Redis
    try {
      const redis = getRedis();
      const isBlacklisted = await redis.get(`blacklist:${token}`);
      if (isBlacklisted) {
        next(new AppError(401, 'UNAUTHORIZED', 'Token has been blacklisted'));
        return;
      }
    } catch (err) {
      logger.warn(err, 'Redis read failed during token verification');
    }

    req.user = decoded;
    next();
  } catch {
    next(new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
  }
}
