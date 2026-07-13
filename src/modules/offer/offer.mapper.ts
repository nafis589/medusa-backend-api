import type { OfferListRow } from './offer.entity';

export interface OfferResponse {
  id: string;
  product_id: string;
  buyer_id: string;
  vendor_id: string;
  amount: number;
  status: string;
  counter_amount: number | null;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
  product: {
    title: string;
    brand: string | null;
    price: number;
    image: string | null;
  };
  shop_name: string;
  buyer_name: string;
  /** Final agreed price when ACCEPTED (counter_amount if accepted via counter). */
  final_amount: number | null;
  /** True once an order has been placed from this accepted offer. */
  consumed: boolean;
}

export function mapOfferResponse(row: OfferListRow): OfferResponse {
  const finalAmount = row.status === 'ACCEPTED' ? row.amount : null;

  return {
    id: row.id,
    product_id: row.product_id,
    buyer_id: row.buyer_id,
    vendor_id: row.vendor_id,
    amount: row.amount,
    status: row.status,
    counter_amount: row.counter_amount,
    expires_at: row.expires_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    product: {
      title: row.product_title,
      brand: row.product_brand,
      price: row.product_price,
      image: row.product_image,
    },
    shop_name: row.shop_name,
    buyer_name: row.buyer_name?.trim() || 'Client',
    final_amount: finalAmount,
    consumed: row.consumed_at != null,
  };
}

export function mapOffersResponse(rows: OfferListRow[]): OfferResponse[] {
  return rows.map(mapOfferResponse);
}
