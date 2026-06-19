import { Router } from 'express';
import { z } from 'zod';
import { validateParams, validateQuery } from '@shared/middlewares/validate';
import { authenticate } from '@shared/middlewares/authenticate';
import type { ProductStatus } from '@modules/product/product.entity';
import { createVendorPublicService } from './vendor-public.service';

const router = Router();
const service = createVendorPublicService();

const VendorIdSchema = z.object({
  id: z.string().uuid('Vendor id must be a valid UUID'),
});

const VendorProductsQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'SOLD']).default('ACTIVE'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(24),
});

type VendorProductsQuery = z.infer<typeof VendorProductsQuerySchema>;

/**
 * GET /api/store/vendors/:id — public vendor profile
 */
router.get('/:id', validateParams(VendorIdSchema), async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const data = await service.getProfile(id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/store/vendors/:id/products?status=ACTIVE|SOLD&page=&limit=
 */
router.get(
  '/:id/products',
  validateParams(VendorIdSchema),
  validateQuery(VendorProductsQuerySchema),
  async (req, res, next) => {
    try {
      const { id } = req.params as { id: string };
      const query = req.query as unknown as VendorProductsQuery;
      const { products, total, page, limit } = await service.listProducts(
        id,
        query.status as ProductStatus,
        query.page,
        query.limit,
      );
      res.json({
        data: products,
        meta: service.getListMeta(total, page, limit),
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/store/vendors/:id/follow-status (auth)
 */
router.get(
  '/:id/follow-status',
  authenticate,
  validateParams(VendorIdSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params as { id: string };
      const data = await service.getFollowStatus(req.user!.id, id);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/store/vendors/:id/follow (auth)
 */
router.post('/:id/follow', authenticate, validateParams(VendorIdSchema), async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const data = await service.follow(req.user!.id, id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/store/vendors/:id/follow (auth)
 */
router.delete(
  '/:id/follow',
  authenticate,
  validateParams(VendorIdSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params as { id: string };
      const data = await service.unfollow(req.user!.id, id);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
