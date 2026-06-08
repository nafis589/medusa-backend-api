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

/** Helper function to invalidate cache on modification */
async function invalidateCache(): Promise<void> {
  try {
    const redis = getRedis();
    await redis.del('categories:tree');
  } catch (err) {
    logger.warn(err, 'Failed to invalidate categories cache key in Redis');
  }
}

/**
 * POST /api/admin/categories
 * Creates a new category. Invalidates categories tree cache.
 */
router.post('/', validate(CreateCategorySchema), async (req, res, next) => {
  try {
    const category = await service.create(req.body as CreateCategoryInput);
    await invalidateCache();
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
    res.json({ data: { message: 'Category deleted successfully' } });
  } catch (err) {
    next(err);
  }
});

export default router;
