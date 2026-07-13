import { Router } from 'express';
import { authenticate } from '@shared/middlewares/authenticate';
import { authorize } from '@shared/middlewares/authorize';
import { validate, validateParams } from '@shared/middlewares/validate';
import { createFavoriteService } from '@modules/favorite/favorite.factory';
import {
  CreateFavoriteSchema,
  FavoriteProductIdSchema,
  type CreateFavoriteInput,
} from '@modules/favorite/favorite.schema';

const router = Router();
const service = createFavoriteService();

router.use(authenticate);
router.use(authorize('BUYER', 'VENDOR'));

/**
 * GET /api/store/favorites
 */
router.get('/', async (req, res, next) => {
  try {
    const favorites = await service.list(req.user!.id);
    res.json({ data: favorites });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/store/favorites
 */
router.post('/', validate(CreateFavoriteSchema), async (req, res, next) => {
  try {
    const { product_id } = req.body as CreateFavoriteInput;
    const result = await service.add(req.user!.id, product_id);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/store/favorites/:productId
 */
router.delete('/:productId', validateParams(FavoriteProductIdSchema), async (req, res, next) => {
  try {
    const { productId } = req.params as { productId: string };
    await service.remove(req.user!.id, productId);
    res.json({ data: { message: 'Favorite removed' } });
  } catch (err) {
    next(err);
  }
});

export default router;
