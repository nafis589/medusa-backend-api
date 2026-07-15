import type { TogoRegion } from './togo-regions';
import type { VendorLocation } from './vendor-location.entity';
import type { VendorShippingRegion } from './vendor-shipping-region.entity';

export type ShippingMethod = 'PER_KM' | 'FIXED';

export type ShippingFeeErrorCode =
  | 'LOCATION_OUTSIDE_TOGO'
  | 'REGION_NOT_COVERED'
  | 'VENDOR_SHIPPING_NOT_SET'
  | 'SHIPPING_CONFIG_INVALID';

export interface ShippingFeeError {
  code: ShippingFeeErrorCode;
  message: string;
  region?: string;
  coveredRegions?: string[];
}

export interface ShippingFeeResult {
  fee: number;
  method: ShippingMethod | null;
  regionId?: string;
  distanceKm?: number;
  detail?: string;
  error?: ShippingFeeError;
}

export interface CartShippingItemSummary {
  product_id: string;
  title: string;
  quantity: number;
  price: number;
}

export interface CartVendorShippingResult {
  vendor_id: string;
  shop_name: string;
  items: CartShippingItemSummary[];
  items_total: number;
  shipping: {
    fee: number;
    method: ShippingMethod | null;
    distanceKm?: number;
    detail?: string;
    error?: ShippingFeeError;
  };
}

export interface CartShippingSummary {
  items_total: number;
  shipping_total: number;
  grand_total: number;
  has_errors: boolean;
  can_checkout: boolean;
}

export interface CartShippingCalculateResult {
  vendors: CartVendorShippingResult[];
  summary: CartShippingSummary;
}

export interface VendorShippingConfig {
  location: VendorLocation | null;
  regions: VendorShippingRegion[];
}

export interface SaveVendorShippingLocation {
  lat: number;
  lng: number;
  address?: string | null;
  city?: string | null;
}

export interface SaveVendorShippingRegionInput {
  region_id: string;
  is_home_region: boolean;
  price_per_km?: number | null;
  min_fee?: number;
  fixed_price?: number | null;
}

export interface SaveVendorShippingData {
  location: SaveVendorShippingLocation;
  regions: SaveVendorShippingRegionInput[];
}

export interface ValidateLocationResult {
  isInTogo: boolean;
  region?: TogoRegion;
}
