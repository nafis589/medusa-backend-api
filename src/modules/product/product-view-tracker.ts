import type { Request } from 'express';
import { getRedis } from '@shared/utils/redis';
import { logger } from '@shared/utils/logger';
import { findVendorIdByUserId } from '@modules/vendor/vendor.util';

const VIEW_TTL_SECONDS = 86400;

function resolveViewerKey(req: Request): string {
  if (req.user?.id) return req.user.id;

  const sessionId = req.cookies?.session_id as string | undefined;
  if (sessionId) return sessionId;

  return `ip:${req.ip ?? 'unknown'}`;
}

/**
 * Checks Redis dedup and schedules an async views_count increment.
 * Does not block the HTTP response beyond a single Redis GET.
 */
export async function trackProductViewIfEligible(
  req: Request,
  productId: string,
  productVendorId: string,
  incrementViews: (id: string) => Promise<void>,
): Promise<void> {
  if (req.user?.id) {
    const viewerVendorId = await findVendorIdByUserId(req.user.id);
    if (viewerVendorId === productVendorId) return;
  }

  const viewKey = `view:${productId}:${resolveViewerKey(req)}`;

  try {
    const redis = getRedis();
    const alreadyViewed = await redis.get(viewKey);
    if (alreadyViewed) return;
  } catch (err) {
    logger.warn(err, 'Redis read failed during product view tracking, skipping increment');
    return;
  }

  setImmediate(() => {
    void (async () => {
      try {
        const redis = getRedis();
        await redis.setex(viewKey, VIEW_TTL_SECONDS, '1');
        await incrementViews(productId);
      } catch (err) {
        logger.warn(err, 'Failed to increment product views');
      }
    })();
  });
}
