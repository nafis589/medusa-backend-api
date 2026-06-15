import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '@shared/errors/app-error';
import { validateQuery } from '@shared/middlewares/validate';
import { getActiveVendorIdByUserId } from './vendor.util';
import { VendorStatsRepository } from './vendor-stats.repository';
import { VendorStatsService } from './vendor-stats.service';

const router = Router();
const service = new VendorStatsService(new VendorStatsRepository());

const ChartQuerySchema = z.object({
  period: z.enum(['week', 'month', 'year']).default('month'),
});

async function resolveVendorId(req: import('express').Request): Promise<string> {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'No token provided');
  }
  return getActiveVendorIdByUserId(userId);
}

/**
 * GET /api/vendor/stats
 */
router.get('/', async (req, res, next) => {
  try {
    const vendorId = await resolveVendorId(req);
    const stats = await service.getStats(vendorId);
    res.json({ data: stats });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/vendor/stats/chart?period=week|month|year
 */
router.get('/chart', validateQuery(ChartQuerySchema), async (req, res, next) => {
  try {
    const vendorId = await resolveVendorId(req);
    const { period } = req.query as z.infer<typeof ChartQuerySchema>;
    const data = await service.getChartData(vendorId, period);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

export default router;
