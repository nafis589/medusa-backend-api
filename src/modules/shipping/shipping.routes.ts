import { Router } from 'express';
import type { z } from 'zod';
import { AppError } from '@shared/errors/app-error';
import { createCartService } from '@modules/cart/cart.factory';
import { createResolveCartMiddleware } from '../../api/store/cart/resolve-cart.middleware';
import { ShippingService } from './shipping.service';
import { VendorLocationRepository } from './vendor-location.repository';
import { VendorShippingRegionRepository } from './vendor-shipping-region.repository';
import { validate } from '@shared/middlewares/validate';
import { CalculateShippingSchema, ValidateLocationSchema } from './shipping.schema';

const router = Router();
const shippingService = new ShippingService(
  new VendorLocationRepository(),
  new VendorShippingRegionRepository(),
);
const cartService = createCartService();
const resolveCart = createResolveCartMiddleware(cartService);

/**
 * POST /api/store/shipping/calculate
 * Always returns 200 — business errors are included per vendor in data.vendors[].shipping.error.
 */
router.post('/calculate', resolveCart, validate(CalculateShippingSchema), async (req, res, next) => {
  try {
    const { client_lat, client_lng, cart_id } = req.body as z.infer<typeof CalculateShippingSchema>;
    const userId = req.user?.id;
    const sessionId = userId ? undefined : req.cartSessionId;

    let cart;
    if (cart_id && cart_id !== req.cart!.id) {
      const specified = await cartService.getCartById(cart_id);
      if (!specified) {
        throw AppError.notFound('Cart');
      }
      cartService.assertCartAccess(specified.cart, userId, sessionId);
      cart = specified;
    } else {
      cart = await cartService.getCart(userId, sessionId);
    }

    const result = await shippingService.calculateCartShipping(cart, client_lat, client_lng);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/store/shipping/validate-location
 */
router.post('/validate-location', validate(ValidateLocationSchema), async (req, res, next) => {
  try {
    const { lat, lng } = req.body as z.infer<typeof ValidateLocationSchema>;
    const result = shippingService.validateLocation(lat, lng);

    res.json({
      data: {
        isInTogo: result.isInTogo,
        region: result.region
          ? {
              id: result.region.id,
              name: result.region.name,
              capital: result.region.capital,
            }
          : undefined,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
