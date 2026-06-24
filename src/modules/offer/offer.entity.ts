export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'COUNTER' | 'EXPIRED';

export interface Offer {
  id: string;
  product_id: string;
  buyer_id: string;
  vendor_id: string;
  amount: number;
  status: OfferStatus;
  counter_amount: number | null;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateOfferData {
  id: string;
  product_id: string;
  buyer_id: string;
  vendor_id: string;
  amount: number;
  expires_at: Date;
}

export interface OfferListRow extends Offer {
  product_title: string;
  product_brand: string | null;
  product_price: number;
  product_image: string | null;
  shop_name: string;
}
