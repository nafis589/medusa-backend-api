export { TOGO_REGIONS, TOGO_BOUNDS, type TogoRegion } from './togo-regions';
export { calculateDistance } from './haversine';
export { ShippingService } from './shipping.service';
export type {
  ShippingFeeResult,
  ShippingFeeError,
  ShippingMethod,
  VendorShippingConfig,
  SaveVendorShippingData,
  ValidateLocationResult,
} from './shipping.types';

export type {
  VendorLocation,
  CreateVendorLocationData,
  UpdateVendorLocationData,
} from './vendor-location.entity';
export type {
  VendorShippingRegion,
  CreateVendorShippingRegionData,
  UpdateVendorShippingRegionData,
} from './vendor-shipping-region.entity';

export {
  TogoRegionIdSchema,
  VendorLocationSchema,
  VendorShippingRegionInputSchema,
  VendorShippingRegionsSchema,
  SaveVendorShippingSchema,
  CalculateShippingSchema,
  ValidateLocationSchema,
} from './shipping.schema';

export { default as shippingRoutes } from './shipping.routes';
export { default as vendorShippingRoutes } from './vendor-shipping.routes';

export type { IVendorLocationRepository } from './vendor-location.repository.interface';
export type { IVendorShippingRegionRepository } from './vendor-shipping-region.repository.interface';
export { VendorLocationRepository } from './vendor-location.repository';
export { VendorShippingRegionRepository } from './vendor-shipping-region.repository';
