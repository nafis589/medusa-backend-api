import {
  VendorLocationSchema,
  VendorShippingRegionInputSchema,
} from '../shipping.schema';

describe('VendorShippingRegionInputSchema', () => {
  it('accepts home region with price_per_km and min_fee', () => {
    const result = VendorShippingRegionInputSchema.safeParse({
      region_id: 'maritime',
      is_home_region: true,
      price_per_km: 150,
      min_fee: 500,
    });
    expect(result.success).toBe(true);
  });

  it('rejects home region without price_per_km', () => {
    const result = VendorShippingRegionInputSchema.safeParse({
      region_id: 'maritime',
      is_home_region: true,
      min_fee: 500,
    });
    expect(result.success).toBe(false);
  });

  it('rejects home region without min_fee', () => {
    const result = VendorShippingRegionInputSchema.safeParse({
      region_id: 'maritime',
      is_home_region: true,
      price_per_km: 150,
    });
    expect(result.success).toBe(false);
  });

  it('accepts inter-region config with fixed_price', () => {
    const result = VendorShippingRegionInputSchema.safeParse({
      region_id: 'plateaux',
      is_home_region: false,
      fixed_price: 3000,
    });
    expect(result.success).toBe(true);
  });

  it('rejects inter-region config without fixed_price', () => {
    const result = VendorShippingRegionInputSchema.safeParse({
      region_id: 'plateaux',
      is_home_region: false,
    });
    expect(result.success).toBe(false);
  });
});

describe('VendorLocationSchema', () => {
  it('accepts a valid location payload', () => {
    const result = VendorLocationSchema.safeParse({
      latitude: 6.1375,
      longitude: 1.2123,
      region_id: 'maritime',
      address: 'Lomé',
      city: 'Lomé',
      is_valid: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown region_id', () => {
    const result = VendorLocationSchema.safeParse({
      latitude: 6.1375,
      longitude: 1.2123,
      region_id: 'invalid',
    });
    expect(result.success).toBe(false);
  });
});
