import { Router } from 'express';
import { CategoryService } from './category.service';
import { CategoryRepository } from './category.repository';
import { CreateCategorySchema, UpdateCategorySchema, CategoryIdSchema, type CreateCategoryInput, type UpdateCategoryInput } from './category.schema';
import { validate, validateParams } from '@shared/middlewares/validate';
import { getRedis } from '@shared/utils/redis';
import { logger } from '@shared/utils/logger';

const router = Router();
const repo = new CategoryRepository();
const service = new CategoryService(repo);

const STOREFRONT_URL = process.env.STOREFRONT_URL ?? process.env.NEXT_PUBLIC_STOREFRONT_URL;
const REVALIDATION_SECRET = process.env.REVALIDATION_SECRET;

/** Helper function to invalidate cache on modification */
async function invalidateCache(): Promise<void> {
  try {
    const redis = getRedis();
    await redis.del('categories:tree');
  } catch (err) {
    logger.warn(err, 'Failed to invalidate categories cache key in Redis');
  }
}

async function revalidateStorefront(): Promise<void> {
  if (!STOREFRONT_URL || !REVALIDATION_SECRET) {
    logger.warn('STOREFRONT_URL or REVALIDATION_SECRET not set — skipping Next.js revalidation');
    return;
  }

  try {
    const res = await fetch(`${STOREFRONT_URL.replace(/\/$/, '')}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${REVALIDATION_SECRET}`,
      },
      body: JSON.stringify({ paths: ['/', '/categories'] }),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, 'Storefront revalidation request failed');
    }
  } catch (err) {
    logger.warn(err, 'Failed to call storefront revalidation API');
  }
}

/**
 * POST /api/admin/categories/revalidate
 * Invalidates Redis cache and triggers Next.js on-demand revalidation.
 */
router.post('/revalidate', async (_req, res, next) => {
  try {
    await invalidateCache();
    await revalidateStorefront();
    res.json({ data: { message: 'Categories cache invalidated' } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/categories
 * Creates a new category. Invalidates categories tree cache.
 */
router.post('/', validate(CreateCategorySchema), async (req, res, next) => {
  try {
    const category = await service.create(req.body as CreateCategoryInput);
    await invalidateCache();
    await revalidateStorefront();
    res.status(201).json({ data: category });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/admin/categories/:id
 * Updates an existing category. Invalidates categories tree cache.
 */
router.patch(
  '/:id',
  validateParams(CategoryIdSchema),
  validate(UpdateCategorySchema),
  async (req, res, next) => {
    try {
      const { id } = req.params as { id: string };
      const category = await service.update(id, req.body as UpdateCategoryInput);
      await invalidateCache();
      await revalidateStorefront();
      res.json({ data: category });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/admin/categories/:id
 * Deletes a category if no products are attached. Invalidates categories tree cache.
 */
router.delete('/:id', validateParams(CategoryIdSchema), async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    await service.delete(id);
    await invalidateCache();
    await revalidateStorefront();
    res.json({ data: { message: 'Category deleted successfully' } });
  } catch (err) {
    next(err);
  }
});

export default router;
