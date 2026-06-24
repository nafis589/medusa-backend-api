import { randomUUID } from 'crypto';
import { AppError } from '@shared/errors/app-error';
import { calculateDistance } from './haversine';
import { TOGO_BOUNDS, TOGO_REGIONS, type TogoRegion } from './togo-regions';
import type { IVendorLocationRepository } from './vendor-location.repository.interface';
import type { IVendorShippingRegionRepository } from './vendor-shipping-region.repository.interface';
import { VendorShippingRegionsSchema } from './shipping.schema';
import type {
  SaveVendorShippingData,
  ShippingFeeResult,
  ValidateLocationResult,
  VendorShippingConfig,
} from './shipping.types';

export class ShippingService {
  constructor(
    private readonly vendorLocationRepo: IVendorLocationRepository,
    private readonly vendorShippingRegionRepo: IVendorShippingRegionRepository,
  ) {}

  getRegionFromCoords(lat: number, lng: number): TogoRegion | null {
    if (
      lat < TOGO_BOUNDS.minLat ||
      lat > TOGO_BOUNDS.maxLat ||
      lng < TOGO_BOUNDS.minLng ||
      lng > TOGO_BOUNDS.maxLng
    ) {
      return null;
    }

    const region = TOGO_REGIONS.find(
      (r) =>
        lat >= r.bounds.minLat &&
        lat <= r.bounds.maxLat &&
        lng >= r.bounds.minLng &&
        lng <= r.bounds.maxLng,
    );

    if (region) return region;

    // Inside Togo but between region boxes — assign nearest region center
    let nearest: TogoRegion | null = null;
    let minDist = Infinity;
    for (const r of TOGO_REGIONS) {
      const dist = calculateDistance(lat, lng, r.center.lat, r.center.lng);
      if (dist < minDist) {
        minDist = dist;
        nearest = r;
      }
    }
    return nearest;
  }

  validateLocation(lat: number, lng: number): ValidateLocationResult {
    const region = this.getRegionFromCoords(lat, lng);
    if (!region) {
      return { isInTogo: false };
    }
    return { isInTogo: true, region };
  }

  async getVendorShipping(vendorId: string): Promise<VendorShippingConfig> {
    const [location, regions] = await Promise.all([
      this.vendorLocationRepo.findByVendorId(vendorId),
      this.vendorShippingRegionRepo.findByVendorId(vendorId),
    ]);

    return { location, regions };
  }

  async calculateShippingFee(params: {
    vendorId: string;
    clientLat: number;
    clientLng: number;
  }): Promise<ShippingFeeResult> {
    const [vendorLocation, shippingConfig] = await Promise.all([
      this.vendorLocationRepo.findByVendorId(params.vendorId),
      this.vendorShippingRegionRepo.findByVendorId(params.vendorId),
    ]);

    if (!vendorLocation || shippingConfig.length === 0) {
      return {
        fee: 0,
        method: null,
        error: {
          code: 'VENDOR_SHIPPING_NOT_SET',
          message: "Le vendeur n'a pas configuré sa livraison.",
        },
      };
    }

    const clientRegion = this.getRegionFromCoords(params.clientLat, params.clientLng);

    if (!clientRegion) {
      return {
        fee: 0,
        method: null,
        error: {
          code: 'LOCATION_OUTSIDE_TOGO',
          message:
            "Votre position est en dehors du Togo. La livraison n'est disponible qu'au Togo.",
        },
      };
    }

    const regionConfig = shippingConfig.find((c) => c.region_id === clientRegion.id);

    if (!regionConfig) {
      return {
        fee: 0,
        method: null,
        error: {
          code: 'REGION_NOT_COVERED',
          message: `Le vendeur ne livre pas en région ${clientRegion.name}.`,
          region: clientRegion.name,
          coveredRegions: shippingConfig.map((c) => c.region_id),
        },
      };
    }

    if (clientRegion.id === vendorLocation.region_id) {
      if (regionConfig.price_per_km == null) {
        return {
          fee: 0,
          method: null,
          error: {
            code: 'SHIPPING_CONFIG_INVALID',
            message: 'Configuration de livraison locale incomplète pour ce vendeur.',
          },
        };
      }

      const distanceKm = calculateDistance(
        vendorLocation.latitude,
        vendorLocation.longitude,
        params.clientLat,
        params.clientLng,
      );

      const fee = Math.max(
        regionConfig.min_fee,
        Math.round(distanceKm * regionConfig.price_per_km),
      );

      return {
        fee,
        method: 'PER_KM',
        regionId: clientRegion.id,
        distanceKm,
        detail: `${Math.round(distanceKm)} km × ${regionConfig.price_per_km} FCFA/km`,
      };
    }

    if (regionConfig.fixed_price == null) {
      return {
        fee: 0,
        method: null,
        error: {
          code: 'SHIPPING_CONFIG_INVALID',
          message: 'Configuration de livraison inter-région incomplète pour ce vendeur.',
        },
      };
    }

    return {
      fee: regionConfig.fixed_price,
      method: 'FIXED',
      regionId: clientRegion.id,
      detail: `Livraison inter-région vers ${clientRegion.name}`,
    };
  }

  async saveVendorShipping(vendorId: string, data: SaveVendorShippingData): Promise<void> {
    const detectedRegion = this.getRegionFromCoords(data.location.lat, data.location.lng);

    if (!detectedRegion) {
      throw new AppError(
        400,
        'LOCATION_OUTSIDE_TOGO',
        'La position doit être située au Togo pour configurer la livraison.',
      );
    }

    const parsedRegions = VendorShippingRegionsSchema.parse(data.regions);

    const homeRegions = parsedRegions.filter((r) => r.is_home_region);
    if (homeRegions.length !== 1) {
      throw AppError.badRequest('Exactement une région domicile (is_home_region) est requise.');
    }

    if (homeRegions[0].region_id !== detectedRegion.id) {
      throw AppError.badRequest(
        'La région domicile doit correspondre à la position du vendeur.',
      );
    }

    const existingLocation = await this.vendorLocationRepo.findByVendorId(vendorId);

    await this.vendorLocationRepo.upsert({
      id: existingLocation?.id ?? randomUUID(),
      vendor_id: vendorId,
      latitude: data.location.lat,
      longitude: data.location.lng,
      region_id: detectedRegion.id,
      address: data.location.address ?? null,
      city: data.location.city ?? null,
      is_valid: true,
    });

    await this.vendorShippingRegionRepo.replaceAllForVendor(
      vendorId,
      parsedRegions.map((region) => ({
        id: randomUUID(),
        vendor_id: vendorId,
        region_id: region.region_id,
        is_home_region: region.is_home_region,
        price_per_km: region.price_per_km ?? null,
        min_fee: region.min_fee ?? 500,
        fixed_price: region.fixed_price ?? null,
      })),
    );
  }
}
