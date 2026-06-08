import { Router } from 'express';
import { CategoryService } from './category.service';
import { CategoryRepository } from './category.repository';
import { CategorySlugSchema } from './category.schema';
import { validateParams } from '@shared/middlewares/validate';
import { getRedis } from '@shared/utils/redis';
import { logger } from '@shared/utils/logger';

const router = Router();
const repo = new CategoryRepository();
const service = new CategoryService(repo);

/**
 * GET /api/store/categories
 * Returns the full category tree. Results are cached in Redis for 1 hour.
 */
router.get('/', async (_req, res, next) => {
  try {
    const redis = getRedis();
    let cached: string | null = null;

    try {
      cached = await redis.get('categories:tree');
    } catch (err) {
      logger.warn(err, 'Redis read failed on categories:tree, falling back to database');
    }

    if (cached) {
      res.json({ data: JSON.parse(cached) as unknown });
      return;
    }

    const tree = await service.getTree();

    try {
      await redis.set('categories:tree', JSON.stringify(tree), 'EX', 3600);
    } catch (err) {
      logger.warn(err, 'Redis write failed on categories:tree');
    }

    res.json({ data: tree });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/store/categories/:slug
 * Returns a category and its immediate children by slug.
 */
router.get('/:slug', validateParams(CategorySlugSchema), async (req, res, next) => {
  try {
    const { slug } = req.params as { slug: string };
    const category = await service.findBySlug(slug);
    res.json({ data: category });
  } catch (err) {
    next(err);
  }
});

export default router;
