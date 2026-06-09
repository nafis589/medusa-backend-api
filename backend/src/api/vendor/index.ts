import { Router } from 'express';
import { authenticate } from '@shared/middlewares/authenticate';
import { authorize } from '@shared/middlewares/authorize';
import { rateLimit } from '@shared/middlewares/rate-limit';
import vendorAuthRoutes from '../../modules/auth/vendor-auth.routes';

const router = Router();

// ── Vendor auth (Phase 2) ─────────────────────────────────────────────────
router.use('/auth', vendorAuthRoutes);

// Authenticated vendor — 200 req/min
router.use(authenticate);
router.use(authorize('VENDOR'));
router.use(rateLimit({ windowMs: 60 * 1000, max: 200 }));

// ── Product management (Phase 4) ──────────────────────────────────────────
// import vendorProductRoutes from '@modules/product/vendor-product.routes';
// router.use('/products', vendorProductRoutes);

// ── Order management (Phase 6) ────────────────────────────────────────────
// import vendorOrderRoutes from '@modules/order/vendor-order.routes';
// router.use('/orders', vendorOrderRoutes);

// ── Shipping config (Phase 3) ─────────────────────────────────────────────
// import vendorShippingRoutes from '@modules/shipping/vendor-shipping.routes';
// router.use('/shipping', vendorShippingRoutes);

// ── Vendor profile + stats (Phase 7) ─────────────────────────────────────
// import vendorProfileRoutes from '@modules/vendor/vendor-profile.routes';
// router.use('/profile', vendorProfileRoutes);
// router.use('/stats',   vendorProfileRoutes);

export default router;
