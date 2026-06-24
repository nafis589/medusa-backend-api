import { Router } from 'express';
import { validateQuery } from '@shared/middlewares/validate';
import { createProductService } from './product.factory';
import {
  ProductSearchQuerySchema,
  ProductSearchFiltersQuerySchema,
  type ProductSearchQueryInput,
  type ProductSearchFiltersQueryInput,
} from './product.schema';
import type { ProductListFilters } from './product.types';

const router = Router();
const service = createProductService();

function mapSearchFilters(query: ProductSearchQueryInput): ProductListFilters {
  return {
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
 * GET /api/store/search/popular
 */
router.get('/popular', async (_req, res, next) => {
  try {
    const data = await service.getPopularSearchTerms(8);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/store/search/filters?q=
 */
router.get('/filters', validateQuery(ProductSearchFiltersQuerySchema), async (req, res, next) => {
  try {
    const { q } = req.query as unknown as ProductSearchFiltersQueryInput;
    const data = await service.getSearchFilters(q);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/store/search?q=
 */
router.get('/', validateQuery(ProductSearchQuerySchema), async (req, res, next) => {
  try {
    const query = req.query as unknown as ProductSearchQueryInput;

    if (query.suggest) {
      const data = await service.searchSuggest(query.q, query.limit ?? 8);
      res.json({ data });
      return;
    }

    const { q, page, limit } = query;
    const { products, total, page: safePage, limit: safeLimit } = await service.search(
      q,
      page,
      limit,
      mapSearchFilters(query),
    );
    res.json({
      data: products,
      meta: service.getListMeta(total, safePage, safeLimit),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
