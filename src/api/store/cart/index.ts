import { Router } from 'express';
import type { z } from 'zod';
import { createCartService } from '@modules/cart/cart.factory';
import { validate, validateParams } from '@shared/middlewares/validate';
import {
  AddCartItemSchema,
  AddOfferCartItemSchema,
  UpdateCartItemSchema,
  CartItemIdSchema,
} from './cart.schema';
import { AppError } from '@shared/errors/app-error';
import { createResolveCartMiddleware } from './resolve-cart.middleware';
import { mapCartResponse } from './cart.mapper';
import { findVendorIdByUserId } from '@modules/vendor/vendor.util';

const router = Router();
const cartService = createCartService();
const resolveCart = createResolveCartMiddleware(cartService);

router.use(resolveCart);

/**
 * GET /api/store/cart
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const sessionId = userId ? undefined : req.cartSessionId;
    const cart = await cartService.getCart(userId, sessionId);
    res.json({ data: mapCartResponse(cart) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/store/cart/items
 */
router.post('/items', validate(AddCartItemSchema), async (req, res, next) => {
  try {
    const { product_id, quantity } = req.body as z.infer<typeof AddCartItemSchema>;

    let buyerVendorId: string | undefined;
    if (req.user?.role === 'VENDOR') {
      buyerVendorId = (await findVendorIdByUserId(req.user.id)) ?? undefined;
    }

    await cartService.addItem(req.cart!.id, product_id, quantity, buyerVendorId);

    const userId = req.user?.id;
    const sessionId = userId ? undefined : req.cartSessionId;
    const cart = await cartService.getCart(userId, sessionId);
    res.status(201).json({ data: mapCartResponse(cart) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/store/cart/offer-items
 * Adds the product of an accepted offer to the cart at the agreed price.
 */
router.post('/offer-items', validate(AddOfferCartItemSchema), async (req, res, next) => {
  try {
    if (!req.user?.id) {
      throw new AppError(401, 'UNAUTHORIZED', 'Vous devez être connecté pour commander une offre.');
    }
    const { offer_id } = req.body as z.infer<typeof AddOfferCartItemSchema>;

    await cartService.addOfferItem(req.cart!.id, req.user.id, offer_id);

    const cart = await cartService.getCart(req.user.id, undefined);
    res.status(201).json({ data: mapCartResponse(cart) });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/store/cart/items/:id
 */
router.patch(
  '/items/:id',
  validateParams(CartItemIdSchema),
  validate(UpdateCartItemSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params as z.infer<typeof CartItemIdSchema>;
      const { quantity } = req.body as z.infer<typeof UpdateCartItemSchema>;
      await cartService.updateItem(req.cart!.id, id, quantity);

      const userId = req.user?.id;
      const sessionId = userId ? undefined : req.cartSessionId;
      const cart = await cartService.getCart(userId, sessionId);
      res.json({ data: mapCartResponse(cart) });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/store/cart/items/:id
 */
router.delete('/items/:id', validateParams(CartItemIdSchema), async (req, res, next) => {
  try {
    const { id } = req.params as z.infer<typeof CartItemIdSchema>;
    await cartService.removeItem(req.cart!.id, id);

    const userId = req.user?.id;
    const sessionId = userId ? undefined : req.cartSessionId;
    const cart = await cartService.getCart(userId, sessionId);
    res.json({ data: mapCartResponse(cart) });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/store/cart
 */
router.delete('/', async (req, res, next) => {
  try {
    await cartService.clearCart(req.cart!.id);

    const userId = req.user?.id;
    const sessionId = userId ? undefined : req.cartSessionId;
    const cart = await cartService.getCart(userId, sessionId);
    res.json({ data: mapCartResponse(cart) });
  } catch (err) {
    next(err);
  }
});

export default router;
