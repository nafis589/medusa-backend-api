import { Router } from 'express';
import { validateQuery } from '@shared/middlewares/validate';
import { createProductService } from './product.factory';
import { ProductSearchQuerySchema, type ProductSearchQueryInput } from './product.schema';

const router = Router();
const service = createProductService();

/**
 * GET /api/store/search?q=
 */
router.get('/', validateQuery(ProductSearchQuerySchema), async (req, res, next) => {
  try {
    const { q, page, limit } = req.query as unknown as ProductSearchQueryInput;
    const { products, total, page: safePage, limit: safeLimit } = await service.search(
      q,
      page,
      limit,
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
