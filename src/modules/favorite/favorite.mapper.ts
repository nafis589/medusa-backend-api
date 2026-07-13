import { TOGO_REGIONS } from '@modules/shipping/togo-regions';
import type { FavoriteProductRow } from './favorite.entity';

function resolveVendorRegionName(regionId: string | null): string | null {
  if (!regionId) return null;
  return TOGO_REGIONS.find((r) => r.id === regionId)?.name ?? regionId;
}

export function serializeFavoriteProduct(row: FavoriteProductRow) {
  return {
    id: row.id,
    title: row.title,
    price: row.price,
    brand: row.brand,
    size: row.size,
    condition: row.condition,
    status: row.status,
    primary_image: row.primary_image,
    shop_name: row.shop_name,
    vendor_region: resolveVendorRegionName(row.vendor_region_id),
    favorited_at:
      row.favorited_at instanceof Date
        ? row.favorited_at.toISOString()
        : String(row.favorited_at),
  };
}
