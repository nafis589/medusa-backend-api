/** Order lifecycle status */
export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED';

/** Supported payment methods at checkout */
export type PaymentMethod = 'CASH_ON_DELIVERY' | 'BANK_TRANSFER';

/** How shipping fee was calculated for this order */
export type ShippingMethod = 'PER_KM' | 'FIXED';

/** Delivery address captured at order placement */
export interface ShippingAddress {
  first_name: string;
  last_name: string;
  phone: string;
  notes?: string | null;
  latitude: number;
  longitude: number;
  region_id: string;
  /** Human-readable place name resolved via reverse geocoding at checkout. */
  address_label?: string | null;
}

/** Frozen product details stored on each order line */
export interface ProductSnapshot {
  title: string;
  image: string | null;
  brand: string | null;
}

export interface OrderVendorSummary {
  id: string;
  shop_name: string;
}

export interface OrderListFilters {
  buyer_id?: string;
  vendor_id?: string;
  status?: OrderStatus;
  offset: number;
  limit: number;
}
