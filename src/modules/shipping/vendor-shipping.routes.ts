import { Router } from 'express';
import type { z } from 'zod';
import { ShippingService } from './shipping.service';
import { VendorLocationRepository } from './vendor-location.repository';
import { VendorShippingRegionRepository } from './vendor-shipping-region.repository';
import { validate } from '@shared/middlewares/validate';
import { SaveVendorShippingSchema } from './shipping.schema';
import { AppError } from '@shared/errors/app-error';
import { getVendorIdByUserId } from '@modules/vendor/vendor.util';

const router = Router();
const shippingService = new ShippingService(
  new VendorLocationRepository(),
  new VendorShippingRegionRepository(),
);

function mapVendorShippingResponse(
  config: Awaited<ReturnType<ShippingService['getVendorShipping']>>,
) {
  return {
    location: config.location
      ? {
          lat: config.location.latitude,
          lng: config.location.longitude,
          region_id: config.location.region_id,
          address_label:
            [config.location.address, config.location.city].filter(Boolean).join(', ') || null,
        }
      : null,
    regions: config.regions.map((region) => ({
      region_id: region.region_id,
      is_home_region: region.is_home_region,
      price_per_km: region.price_per_km,
      min_fee: region.min_fee,
      fixed_price: region.fixed_price,
    })),
  };
}

/**
 * GET /api/vendor/shipping
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      next(new AppError(401, 'UNAUTHORIZED', 'No token provided'));
      return;
    }

    const vendorId = await getVendorIdByUserId(userId);
    const config = await shippingService.getVendorShipping(vendorId);
    res.json({ data: mapVendorShippingResponse(config) });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/vendor/shipping
 */
router.patch('/', validate(SaveVendorShippingSchema), async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      next(new AppError(401, 'UNAUTHORIZED', 'No token provided'));
      return;
    }

    const vendorId = await getVendorIdByUserId(userId);
    const body = req.body as z.infer<typeof SaveVendorShippingSchema>;

    await shippingService.saveVendorShipping(vendorId, {
      location: body.location
        ? {
            lat: body.location.lat,
            lng: body.location.lng,
            address: body.location.address,
            city: body.location.city,
          }
        : undefined,
      regions: body.regions,
    });

    const config = await shippingService.getVendorShipping(vendorId);
    res.json({ data: mapVendorShippingResponse(config) });
  } catch (err) {
    next(err);
  }
});

export default router;
