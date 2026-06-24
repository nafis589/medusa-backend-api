import { Router } from 'express';
import { AppError } from '@shared/errors/app-error';
import { validate, validateParams } from '@shared/middlewares/validate';
import { createOfferService } from '@modules/offer/offer.factory';
import { getActiveVendorIdByUserId } from '@modules/vendor/vendor.util';
import {
  CounterOfferSchema,
  OfferIdSchema,
  type CounterOfferInput,
} from '@modules/offer/offer.schema';

const router = Router();
const service = createOfferService();

async function resolveVendorId(req: import('express').Request): Promise<string> {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'No token provided');
  }
  return getActiveVendorIdByUserId(userId);
}

/**
 * GET /api/vendor/offers
 */
router.get('/', async (req, res, next) => {
  try {
    const vendorId = await resolveVendorId(req);
    const offers = await service.listForVendor(vendorId);
    res.json({ data: offers });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/vendor/offers/:id/accept
 */
router.patch('/:id/accept', validateParams(OfferIdSchema), async (req, res, next) => {
  try {
    const vendorId = await resolveVendorId(req);
    const { id } = req.params as { id: string };
    const offer = await service.vendorAccept(id, vendorId);
    res.json({ data: offer });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/vendor/offers/:id/decline
 */
router.patch('/:id/decline', validateParams(OfferIdSchema), async (req, res, next) => {
  try {
    const vendorId = await resolveVendorId(req);
    const { id } = req.params as { id: string };
    const offer = await service.vendorDecline(id, vendorId);
    res.json({ data: offer });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/vendor/offers/:id/counter
 */
router.patch(
  '/:id/counter',
  validateParams(OfferIdSchema),
  validate(CounterOfferSchema),
  async (req, res, next) => {
    try {
      const vendorId = await resolveVendorId(req);
      const { id } = req.params as { id: string };
      const { counter_amount } = req.body as CounterOfferInput;
      const offer = await service.vendorCounter(id, vendorId, counter_amount);
      res.json({ data: offer });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
