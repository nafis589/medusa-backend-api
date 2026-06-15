import { Router } from 'express';
import type { z } from 'zod';
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

/**
 * POST /api/store/shipping/calculate
 * Always returns 200 — business errors are included in data.error.
 */
router.post('/calculate', validate(CalculateShippingSchema), async (req, res, next) => {
  try {
    const { vendor_id, client_lat, client_lng } = req.body as z.infer<
      typeof CalculateShippingSchema
    >;
    const result = await shippingService.calculateShippingFee({
      vendorId: vendor_id,
      clientLat: client_lat,
      clientLng: client_lng,
    });
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
