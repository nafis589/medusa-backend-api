import { Router } from 'express';
import { AppError } from '@shared/errors/app-error';
import { validate, validateParams } from '@shared/middlewares/validate';
import { getActiveVendorIdByUserId } from '@modules/vendor/vendor.util';
import { createProductService } from './product.factory';
import {
  CreateProductSchema,
  ProductIdSchema,
  UpdateProductSchema,
  type CreateProductBody,
  type UpdateProductBody,
} from './product.schema';

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
router.get('/', async (req, res, next) => {
  try {
    const vendorId = await resolveVendorId(req);
    const lowStock = req.query.low_stock === 'true';
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const { products, total, page: safePage, limit: safeLimit } = await service.listByVendor(
      vendorId,
      { low_stock: lowStock || undefined, page, limit },
    );
    res.json({
      data: products,
      meta: service.getListMeta(total, safePage, safeLimit),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/vendor/products
 */
router.post('/', validate(CreateProductSchema), async (req, res, next) => {
  try {
    const vendorId = await resolveVendorId(req);
    const body = req.body as CreateProductBody;
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
  validate(UpdateProductSchema),
  async (req, res, next) => {
    try {
      const vendorId = await resolveVendorId(req);
      const { id } = req.params as { id: string };
      const body = req.body as UpdateProductBody;
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
