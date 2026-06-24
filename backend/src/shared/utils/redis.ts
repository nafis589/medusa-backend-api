import { Redis } from 'ioredis';
import { logger } from './logger';

let _redis: Redis | null = null;
let _warnedUnavailable = false;

/**
 * Returns a singleton instance of Redis, initialized lazily on the first call.
 * Reuses environment variables from .env: REDIS_HOST, REDIS_PORT, REDIS_PASSWORD.
 *
 * Configured to fail fast when Redis is unavailable so that callers (rate-limit,
 * caching) can degrade gracefully instead of hanging on queued commands.
 */
export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD ?? undefined,
      lazyConnect: true,
      // Fail fast instead of queueing commands while Redis is down.
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 2000)),
    });

    _redis.on('error', (err: unknown) => {
      // Only log the first error to avoid flooding the console when Redis is down.
      if (!_warnedUnavailable) {
        _warnedUnavailable = true;
        logger.warn(err, 'Redis connection error (further errors suppressed)');
      }
    });

    _redis.on('ready', () => {
      _warnedUnavailable = false;
    });
  }
  return _redis;
}
