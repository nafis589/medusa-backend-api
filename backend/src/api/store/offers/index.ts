import { Router } from 'express';
import { authenticate } from '@shared/middlewares/authenticate';
import { authorize } from '@shared/middlewares/authorize';
import { validate, validateParams } from '@shared/middlewares/validate';
import { createOfferService } from '@modules/offer/offer.factory';
import {
  CreateOfferSchema,
  OfferIdSchema,
  type CreateOfferInput,
} from '@modules/offer/offer.schema';

const router = Router();
const service = createOfferService();

router.use(authenticate);
router.use(authorize('BUYER', 'VENDOR'));

/**
 * GET /api/store/offers
 */
router.get('/', async (req, res, next) => {
  try {
    const offers = await service.listForBuyer(req.user!.id);
    res.json({ data: offers });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/store/offers
 */
router.post('/', validate(CreateOfferSchema), async (req, res, next) => {
  try {
    const { product_id, amount } = req.body as CreateOfferInput;
    const offer = await service.createOffer(req.user!.id, product_id, amount);
    res.status(201).json({ data: offer });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/store/offers/:id/accept-counter
 */
router.patch('/:id/accept-counter', validateParams(OfferIdSchema), async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const offer = await service.buyerAcceptCounter(id, req.user!.id);
    res.json({ data: offer });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/store/offers/:id/decline
 */
router.patch('/:id/decline', validateParams(OfferIdSchema), async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const offer = await service.buyerDeclineCounter(id, req.user!.id);
    res.json({ data: offer });
  } catch (err) {
    next(err);
  }
});

export default router;
