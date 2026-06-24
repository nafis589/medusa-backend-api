export interface VendorLocation {
  id: string;
  vendor_id: string;
  latitude: number;
  longitude: number;
  region_id: string;
  address: string | null;
  city: string | null;
  is_valid: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateVendorLocationData {
  vendor_id: string;
  latitude: number;
  longitude: number;
  region_id: string;
  address?: string | null;
  city?: string | null;
  is_valid?: boolean;
}

export type UpdateVendorLocationData = Partial<
  Omit<CreateVendorLocationData, 'vendor_id'>
>;
