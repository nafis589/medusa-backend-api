export interface VendorShippingRegion {
  id: string;
  vendor_id: string;
  region_id: string;
  is_home_region: boolean;
  price_per_km: number | null;
  min_fee: number;
  fixed_price: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateVendorShippingRegionData {
  vendor_id: string;
  region_id: string;
  is_home_region?: boolean;
  price_per_km?: number | null;
  min_fee?: number;
  fixed_price?: number | null;
}

export type UpdateVendorShippingRegionData = Partial<
  Omit<CreateVendorShippingRegionData, 'vendor_id' | 'region_id'>
>;
