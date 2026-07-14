import { Router } from 'express';
import { validateParams, validateQuery } from '@shared/middlewares/validate';
import { optionalAuthenticate } from '@shared/middlewares/optional-authenticate';
import { createProductService } from './product.factory';
import { trackProductViewIfEligible } from './product-view-tracker';
import {
  ProductIdSchema,
  ProductListQuerySchema,
  ProductFilterScopeQuerySchema,
  type ProductListQueryInput,
  type ProductFilterScopeQueryInput,
} from './product.schema';
import type { ProductListFilters } from './product.types';

const router = Router();
const service = createProductService();

function mapListFilters(query: ProductListQueryInput): ProductListFilters {
  return {
    category: query.category,
    category_id: query.category_id,
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
    ids: query.ids,
    tag: query.tag,
  };
}

/**
 * GET /api/store/products/filters
 * Returns available filter facets for the current category/tag scope.
 */
router.get('/filters', validateQuery(ProductFilterScopeQuerySchema), async (req, res, next) => {
  try {
    const query = req.query as unknown as ProductFilterScopeQueryInput;
    const data = await service.getFilters(mapListFilters(query));
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/store/products
 */
router.get('/', validateQuery(ProductListQuerySchema), async (req, res, next) => {
  try {
    const query = req.query as unknown as ProductListQueryInput;
    const { products, total, page, limit } = await service.list(mapListFilters(query));
    res.json({
      data: products,
      meta: service.getListMeta(total, page, limit),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/store/products/:id
 */
router.get('/:id', validateParams(ProductIdSchema), optionalAuthenticate, async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const product = await service.findById(id);

    void trackProductViewIfEligible(req, id, product.vendor_id, (productId) =>
      service.incrementViews(productId),
    );

    res.json({ data: product });
  } catch (err) {
    next(err);
  }
});

export default router;
