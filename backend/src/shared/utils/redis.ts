import { Redis } from 'ioredis';
import { logger } from './logger';

let _redis: Redis | null = null;

/**
 * Returns a singleton instance of Redis, initialized lazily on the first call.
 * Reuses environment variables from .env: REDIS_HOST, REDIS_PORT, REDIS_PASSWORD.
 */
export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD ?? undefined,
      lazyConnect: true,
    });

    _redis.on('error', (err: unknown) => {
      logger.warn(err, 'Redis connection error');
    });
  }
  return _redis;
}
