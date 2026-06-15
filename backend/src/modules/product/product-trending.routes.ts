import { Router } from 'express';
import { getRedis } from '@shared/utils/redis';
import { logger } from '@shared/utils/logger';
import { createProductService } from './product.factory';

const router = Router();
const service = createProductService();

/**
 * GET /api/store/trending
 */
router.get('/', async (_req, res, next) => {
  try {
    const redis = getRedis();
    const cacheKey = 'trending:products';

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        res.json({ data: JSON.parse(cached) as unknown });
        return;
      }
    } catch (err) {
      logger.warn(err, 'Redis read failed on trending:products, falling back to database');
    }

    const products = await service.getTrending();

    if (products.length > 0) {
      try {
        await redis.set(cacheKey, JSON.stringify(products), 'EX', 3600);
      } catch (err) {
        logger.warn(err, 'Redis write failed on trending:products');
      }
    }

    res.json({ data: products });
  } catch (err) {
    next(err);
  }
});

export default router;
