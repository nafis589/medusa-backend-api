import type { Request, Response, NextFunction } from 'express';
import { getRedis } from '@shared/utils/redis';
import { AppError } from '@shared/errors/app-error';
import { logger } from '@shared/utils/logger';

interface RateLimitOptions {
  /** Window duration in milliseconds */
  windowMs: number;
  /** Maximum requests per window */
  max: number;
}

/**
 * Usage:
 *   app.use('/api/store', rateLimit({ windowMs: 60000, max: 100 }))
 */
export function rateLimit(opts: RateLimitOptions) {
  const { windowMs, max } = opts;

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip ?? 'unknown';
    const route = req.originalUrl;
    const key = `ratelimit:${ip}:${route}`;

    try {
      const redis = getRedis();
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.pexpire(key, windowMs);
      }

      if (current > max) {
        throw new AppError(
          429,
          'RATE_LIMIT_EXCEEDED',
          `Too many requests — limit is ${String(max)} per ${String(windowMs)}ms`,
        );
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      // Redis failure → fail open (log + allow)
      logger.warn('Rate-limit Redis unavailable, skipping check');
    }

    next();
  };
}
