import { Router } from 'express';
import { AppError } from '@shared/errors/app-error';
import { validate, validateParams, validateQuery } from '@shared/middlewares/validate';
import { getActiveVendorIdByUserId } from '@modules/vendor/vendor.util';
import { createProductService } from './product.factory';
import {
  ProductIdSchema,
  VendorCreateProductSchema,
  VendorProductListQuerySchema,
  VendorUpdateProductSchema,
  type VendorCreateProductBody,
  type VendorProductListQueryInput,
  type VendorUpdateProductBody,
} from './product.schema';
import type { ProductStatus } from './product.entity';

const router = Router();
const service = createProductService();

async function resolveVendorId(req: import('express').Request): Promise<string> {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'No token provided');
  }
  return getActiveVendorIdByUserId(userId);
}

/**
 * GET /api/vendor/products
 */
router.get('/', validateQuery(VendorProductListQuerySchema), async (req, res, next) => {
  try {
    const vendorId = await resolveVendorId(req);
    const query = req.query as unknown as VendorProductListQueryInput;
    const { products, total, page, limit } = await service.listByVendor(vendorId, {
      status: query.status as ProductStatus | undefined,
      search: query.search,
      category_id: query.category_id,
      low_stock: query.low_stock === 'true',
      page: query.page,
      limit: query.limit,
    });
    res.json({
      data: products,
      meta: service.getListMeta(total, page, limit),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/vendor/products
 */
router.post('/', validate(VendorCreateProductSchema), async (req, res, next) => {
  try {
    const vendorId = await resolveVendorId(req);
    const body = req.body as VendorCreateProductBody;
    const product = await service.create(vendorId, body);
    res.status(201).json({ data: product });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/vendor/products/:id
 */
router.get('/:id', validateParams(ProductIdSchema), async (req, res, next) => {
  try {
    const vendorId = await resolveVendorId(req);
    const { id } = req.params as { id: string };
    const product = await service.findVendorProduct(id, vendorId);
    res.json({ data: product });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/vendor/products/:id
 */
router.patch(
  '/:id',
  validateParams(ProductIdSchema),
  validate(VendorUpdateProductSchema),
  async (req, res, next) => {
    try {
      const vendorId = await resolveVendorId(req);
      const { id } = req.params as { id: string };
      const body = req.body as VendorUpdateProductBody;
      const product = await service.update(id, vendorId, body);
      res.json({ data: product });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/vendor/products/:id
 */
router.delete('/:id', validateParams(ProductIdSchema), async (req, res, next) => {
  try {
    const vendorId = await resolveVendorId(req);
    const { id } = req.params as { id: string };
    await service.delete(id, vendorId);
    res.json({ data: { message: 'Product archived successfully' } });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/vendor/products/:id/toggle
 */
router.patch('/:id/toggle', validateParams(ProductIdSchema), async (req, res, next) => {
  try {
    const vendorId = await resolveVendorId(req);
    const { id } = req.params as { id: string };
    const product = await service.toggleStatus(id, vendorId);
    res.json({ data: product });
  } catch (err) {
    next(err);
  }
});

export default router;
