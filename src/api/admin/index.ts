import { Router } from 'express';
import { authenticate } from '@shared/middlewares/authenticate';
import { authorize } from '@shared/middlewares/authorize';
import { rateLimit } from '@shared/middlewares/rate-limit';

const router = Router();

// Admin only — 200 req/min per user
router.use(authenticate);
router.use(authorize('ADMIN'));
router.use(rateLimit({ windowMs: 60 * 1000, max: 200 }));

// ── Category admin (Phase 1) ──────────────────────────────────────────────
import adminCategoryRoutes from '@modules/category/admin-category.routes';
router.use('/categories', adminCategoryRoutes);

// ── Product moderation (Phase 4) ──────────────────────────────────────────
import adminProductRoutes from '@modules/product/admin-product.routes';
router.use('/products', adminProductRoutes);

// ── Vendor management (Phase 7) ───────────────────────────────────────────
import adminVendorRoutes from '@modules/vendor/admin-vendor.routes';
router.use('/vendors', adminVendorRoutes);

// ── Order overview (Phase 6) ──────────────────────────────────────────────
import adminOrderRoutes from '@modules/order/admin-order.routes';
router.use('/orders', adminOrderRoutes);

// ── Admin stats dashboard (Phase 8) ────────────────────────────────────────
import adminStatsRoutes from '@modules/admin/admin-stats.routes';
router.use('/stats', adminStatsRoutes);

// ── User management (Phase 10) ────────────────────────────────────────────
import adminUserRoutes from '@modules/auth/admin-user.routes';
router.use('/users', adminUserRoutes);

export default router;
