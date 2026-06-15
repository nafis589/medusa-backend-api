import { Router } from 'express';
import { CategoryService } from './category.service';
import { CategoryRepository } from './category.repository';
import { CategorySlugSchema } from './category.schema';
import { validateParams, validateQuery } from '@shared/middlewares/validate';
import { createProductService } from '@modules/product/product.factory';
import {
  ProductListQuerySchema,
  type ProductListQueryInput,
} from '@modules/product/product.schema';
import type { ProductListFilters } from '@modules/product/product.types';
import { getRedis } from '@shared/utils/redis';
import { logger } from '@shared/utils/logger';

const router = Router();
const repo = new CategoryRepository();
const service = new CategoryService(repo);
const productService = createProductService();

function mapListFilters(query: ProductListQueryInput): ProductListFilters {
  return {
    category: query.category,
    subcategory: query.subcategory,
    condition: query.condition,
    color: query.color,
    size: query.size,
    material: query.material,
    brand: query.brand,
    price_min: query.price_min,
    price_max: query.price_max,
    sort: query.sort,
    page: query.page,
    limit: query.limit,
  };
}

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

    // Do not cache an empty tree — avoids serving stale [] after a fresh seed
    if (tree.length > 0) {
      try {
        await redis.set('categories:tree', JSON.stringify(tree), 'EX', 3600);
      } catch (err) {
        logger.warn(err, 'Redis write failed on categories:tree');
      }
    }

    res.json({ data: tree });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/store/categories/:slug/products
 * Returns ACTIVE products for a category slug with optional filters.
 */
router.get(
  '/:slug/products',
  validateParams(CategorySlugSchema),
  validateQuery(ProductListQuerySchema),
  async (req, res, next) => {
    try {
      const { slug } = req.params as { slug: string };
      const query = req.query as unknown as ProductListQueryInput;
      const category = await service.findBySlug(slug);
      const categoryIds = await repo.findDescendantIds(category.id);
      const filters = mapListFilters(query);
      const { products, total, page, limit } = await productService.list({
        ...filters,
        category_ids: categoryIds,
      });
      res.json({
        data: products,
        meta: productService.getListMeta(total, page, limit),
      });
    } catch (err) {
      next(err);
    }
  },
);

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
