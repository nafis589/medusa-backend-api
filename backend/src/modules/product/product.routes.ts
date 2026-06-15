import { Router } from 'express';
import { validateParams, validateQuery } from '@shared/middlewares/validate';
import { createProductService } from './product.factory';
import {
  ProductIdSchema,
  ProductListQuerySchema,
  type ProductListQueryInput,
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
router.get('/:id', validateParams(ProductIdSchema), async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const product = await service.findById(id);
    res.json({ data: product });
  } catch (err) {
    next(err);
  }
});

export default router;
