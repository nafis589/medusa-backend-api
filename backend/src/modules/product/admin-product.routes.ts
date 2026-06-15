import { Router } from 'express';
import { validate, validateParams, validateQuery } from '@shared/middlewares/validate';
import { createProductService } from './product.factory';
import {
  AdminProductListQuerySchema,
  ProductIdSchema,
  RejectProductSchema,
  type AdminProductListQueryInput,
  type RejectProductBody,
} from './product.schema';
import type { AdminProductListFilters } from './product.types';

const router = Router();
const service = createProductService();

function mapAdminFilters(query: AdminProductListQueryInput): AdminProductListFilters {
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
    status: query.status,
  };
}

/**
 * GET /api/admin/products
 */
router.get('/', validateQuery(AdminProductListQuerySchema), async (req, res, next) => {
  try {
    const query = req.query as unknown as AdminProductListQueryInput;
    const { products, total, page, limit } = await service.listForAdmin(mapAdminFilters(query));
    res.json({
      data: products,
      meta: service.getListMeta(total, page, limit),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/admin/products/:id/approve
 */
router.patch('/:id/approve', validateParams(ProductIdSchema), async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const product = await service.approve(id);
    res.json({ data: product });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/admin/products/:id/reject
 */
router.patch(
  '/:id/reject',
  validateParams(ProductIdSchema),
  validate(RejectProductSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params as { id: string };
      const { reason } = req.body as RejectProductBody;
      const product = await service.reject(id, reason);
      res.json({ data: product });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
