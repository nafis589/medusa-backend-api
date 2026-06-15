import type {
  VendorShippingRegion,
  CreateVendorShippingRegionData,
} from './vendor-shipping-region.entity';

export interface IVendorShippingRegionRepository {
  findByVendorId(vendorId: string): Promise<VendorShippingRegion[]>;
  findByVendorAndRegion(vendorId: string, regionId: string): Promise<VendorShippingRegion | null>;
  create(data: CreateVendorShippingRegionData & { id: string }): Promise<VendorShippingRegion>;
  deleteByVendorId(vendorId: string): Promise<void>;
  replaceAllForVendor(
    vendorId: string,
    regions: Array<CreateVendorShippingRegionData & { id: string }>,
  ): Promise<VendorShippingRegion[]>;
}
