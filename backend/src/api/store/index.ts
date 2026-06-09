import { Router } from 'express';
import { rateLimit } from '@shared/middlewares/rate-limit';

const router = Router();

// Public rate-limit: 100 req/min per IP
router.use(rateLimit({ windowMs: 60 * 1000, max: 100 }));

// ── Auth routes (Phase 2) ──────────────────────────────────────────────────
import authRoutes from '../../modules/auth/auth.routes';
import profileRoutes from '../../modules/auth/profile.routes';
router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);

// ── Category routes (Phase 1) ─────────────────────────────────────────────
import categoryRoutes from '@modules/category/category.routes';
router.use('/categories', categoryRoutes);

// ── Product routes (Phase 4) ──────────────────────────────────────────────
// import productRoutes from '@modules/product/product.routes';
// router.use('/products', productRoutes);

// ── Cart routes (Phase 5) ─────────────────────────────────────────────────
// import cartRoutes from '@modules/cart/cart.routes';
// router.use('/cart', cartRoutes);

// ── Order routes (Phase 6) ────────────────────────────────────────────────
// import orderRoutes from '@modules/order/order.routes';
// router.use('/orders', orderRoutes);

// ── Shipping routes (Phase 3) ─────────────────────────────────────────────
// import shippingRoutes from '@modules/shipping/shipping.routes';
// router.use('/shipping', shippingRoutes);

// ── Notification routes (Phase 9) ─────────────────────────────────────────
// import notificationRoutes from '@modules/notification/notification.routes';
// router.use('/notifications', notificationRoutes);

// ── Recommendation routes (Phase 11) ──────────────────────────────────────
// import recommendationRoutes from '@modules/recommendation/recommendation.routes';
// router.use('/recommendations', recommendationRoutes);

export default router;
