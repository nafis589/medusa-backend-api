import type {
  VendorLocation,
  CreateVendorLocationData,
  UpdateVendorLocationData,
} from './vendor-location.entity';

export interface IVendorLocationRepository {
  findByVendorId(vendorId: string): Promise<VendorLocation | null>;
  findById(id: string): Promise<VendorLocation | null>;
  create(data: CreateVendorLocationData & { id: string }): Promise<VendorLocation>;
  update(vendorId: string, data: UpdateVendorLocationData): Promise<VendorLocation>;
  upsert(data: CreateVendorLocationData & { id: string }): Promise<VendorLocation>;
}
