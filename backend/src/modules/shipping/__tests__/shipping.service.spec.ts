import { ShippingService } from '../shipping.service';
import { calculateDistance } from '../haversine';
import type { IVendorLocationRepository } from '../vendor-location.repository.interface';
import type { IVendorShippingRegionRepository } from '../vendor-shipping-region.repository.interface';
import type { VendorLocation } from '../vendor-location.entity';
import type { VendorShippingRegion } from '../vendor-shipping-region.entity';
import { AppError } from '@shared/errors/app-error';

function makeVendorLocation(overrides: Partial<VendorLocation> = {}): VendorLocation {
  return {
    id: 'loc-1',
    vendor_id: 'vendor-1',
    latitude: 6.1375,
    longitude: 1.2123,
    region_id: 'maritime',
    address: null,
    city: 'Lomé',
    is_valid: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeShippingRegion(
  overrides: Partial<VendorShippingRegion> = {},
): VendorShippingRegion {
  return {
    id: 'ship-1',
    vendor_id: 'vendor-1',
    region_id: 'maritime',
    is_home_region: true,
    price_per_km: 150,
    min_fee: 500,
    fixed_price: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function buildService(
  location: VendorLocation | null,
  regions: VendorShippingRegion[],
): ShippingService {
  const vendorLocationRepo: IVendorLocationRepository = {
    findByVendorId: jest.fn().mockResolvedValue(location),
    findById: jest.fn().mockResolvedValue(location),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  };

  const vendorShippingRegionRepo: IVendorShippingRegionRepository = {
    findByVendorId: jest.fn().mockResolvedValue(regions),
    findByVendorAndRegion: jest.fn(),
    create: jest.fn(),
    deleteByVendorId: jest.fn(),
    replaceAllForVendor: jest.fn().mockResolvedValue(regions),
  };

  return new ShippingService(vendorLocationRepo, vendorShippingRegionRepo);
}

describe('ShippingService.getRegionFromCoords', () => {
  const service = buildService(null, []);

  it.each([
    [6.14, 1.21, 'maritime'],
    [7.53, 1.13, 'plateaux'],
    [8.98, 1.13, 'centrale'],
    [9.55, 1.19, 'kara'],
    [10.87, 0.2, 'savanes'],
  ] as const)('detects %s region for coords (%s, %s)', (lat, lng, expectedId) => {
    expect(service.getRegionFromCoords(lat, lng)?.id).toBe(expectedId);
  });

  it.each([
    [5.56, -0.2],
    [48.85, 2.35],
  ] as const)('returns null for coords outside Togo (%s, %s)', (lat, lng) => {
    expect(service.getRegionFromCoords(lat, lng)).toBeNull();
  });

  it('assigns nearest region for coords inside Togo but between region boxes', () => {
    const region = service.getRegionFromCoords(6.55, 0.62);
    expect(region).not.toBeNull();
    expect(['maritime', 'plateaux']).toContain(region?.id);
  });
});

describe('calculateDistance', () => {
  it('returns 0 for the same point', () => {
    expect(calculateDistance(6.1375, 1.2123, 6.1375, 1.2123)).toBe(0);
  });

  it('calculates Lomé → Atakpamé ≈ 156 km (±5 km)', () => {
    const distance = calculateDistance(6.1375, 1.2123, 7.5333, 1.1333);
    expect(distance).toBeGreaterThanOrEqual(150.5);
    expect(distance).toBeLessThanOrEqual(160.5);
  });
});

describe('ShippingService.calculateShippingFee', () => {
  it('returns PER_KM with fee ≥ min_fee for same region', async () => {
    const service = buildService(makeVendorLocation(), [makeShippingRegion()]);
    const result = await service.calculateShippingFee({
      vendorId: 'vendor-1',
      clientLat: 6.2,
      clientLng: 1.25,
    });

    expect(result.error).toBeUndefined();
    expect(result.method).toBe('PER_KM');
    expect(result.fee).toBeGreaterThanOrEqual(500);
    expect(result.distanceKm).toBeDefined();
    expect(result.detail).toContain('FCFA/km');
  });

  it('returns FIXED fee for different regions', async () => {
    const service = buildService(makeVendorLocation(), [
      makeShippingRegion(),
      makeShippingRegion({
        id: 'ship-2',
        region_id: 'plateaux',
        is_home_region: false,
        price_per_km: null,
        fixed_price: 3000,
      }),
    ]);

    const result = await service.calculateShippingFee({
      vendorId: 'vendor-1',
      clientLat: 7.53,
      clientLng: 1.13,
    });

    expect(result.error).toBeUndefined();
    expect(result.method).toBe('FIXED');
    expect(result.fee).toBe(3000);
    expect(result.detail).toContain('Plateaux');
  });

  it('returns LOCATION_OUTSIDE_TOGO for client outside Togo', async () => {
    const service = buildService(makeVendorLocation(), [makeShippingRegion()]);
    const result = await service.calculateShippingFee({
      vendorId: 'vendor-1',
      clientLat: 48.85,
      clientLng: 2.35,
    });

    expect(result.error?.code).toBe('LOCATION_OUTSIDE_TOGO');
    expect(result.method).toBeNull();
    expect(result.fee).toBe(0);
  });

  it('returns REGION_NOT_COVERED with coveredRegions', async () => {
    const service = buildService(makeVendorLocation(), [makeShippingRegion()]);
    const result = await service.calculateShippingFee({
      vendorId: 'vendor-1',
      clientLat: 9.55,
      clientLng: 1.19,
    });

    expect(result.error?.code).toBe('REGION_NOT_COVERED');
    expect(result.error?.region).toBe('Kara');
    expect(result.error?.coveredRegions).toEqual(['maritime']);
  });

  it('returns VENDOR_SHIPPING_NOT_SET when vendor has no config', async () => {
    const service = buildService(null, []);
    const result = await service.calculateShippingFee({
      vendorId: 'vendor-1',
      clientLat: 6.14,
      clientLng: 1.21,
    });

    expect(result.error?.code).toBe('VENDOR_SHIPPING_NOT_SET');
  });
});

describe('ShippingService.validateLocation', () => {
  const service = buildService(null, []);

  it('returns isInTogo true with region inside Togo', () => {
    const result = service.validateLocation(6.14, 1.21);
    expect(result.isInTogo).toBe(true);
    expect(result.region?.id).toBe('maritime');
  });

  it('returns isInTogo false outside Togo', () => {
    const result = service.validateLocation(48.85, 2.35);
    expect(result.isInTogo).toBe(false);
    expect(result.region).toBeUndefined();
  });
});

describe('ShippingService.saveVendorShipping', () => {
  it('throws LOCATION_OUTSIDE_TOGO when location is outside Togo', async () => {
    const service = buildService(null, []);
    await expect(
      service.saveVendorShipping('vendor-1', {
        location: { lat: 48.85, lng: 2.35 },
        regions: [
          {
            region_id: 'maritime',
            is_home_region: true,
            price_per_km: 150,
            min_fee: 500,
          },
        ],
      }),
    ).rejects.toThrow(AppError);
  });

  it('saves location and regions when valid', async () => {
    const locationRepo: IVendorLocationRepository = {
      findByVendorId: jest.fn().mockResolvedValue(null),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn().mockResolvedValue(makeVendorLocation()),
    };

    const replaceAll = jest.fn().mockResolvedValue([]);
    const shippingRepo: IVendorShippingRegionRepository = {
      findByVendorId: jest.fn().mockResolvedValue([]),
      findByVendorAndRegion: jest.fn(),
      create: jest.fn(),
      deleteByVendorId: jest.fn(),
      replaceAllForVendor: replaceAll,
    };

    const service = new ShippingService(locationRepo, shippingRepo);

    await service.saveVendorShipping('vendor-1', {
      location: { lat: 6.1375, lng: 1.2123 },
      regions: [
        {
          region_id: 'maritime',
          is_home_region: true,
          price_per_km: 150,
          min_fee: 500,
        },
        {
          region_id: 'plateaux',
          is_home_region: false,
          fixed_price: 3000,
        },
      ],
    });

    expect(locationRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        vendor_id: 'vendor-1',
        region_id: 'maritime',
        is_valid: true,
      }),
    );
    expect(replaceAll).toHaveBeenCalledWith(
      'vendor-1',
      expect.arrayContaining([
        expect.objectContaining({ region_id: 'maritime', is_home_region: true }),
        expect.objectContaining({ region_id: 'plateaux', fixed_price: 3000 }),
      ]),
    );
  });
});
