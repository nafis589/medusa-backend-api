import type { Order } from './order.entity';

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
  search?: string;
  date_from?: string;
  date_to?: string;
  offset: number;
  limit: number;
}

export interface AdminOrderListRow extends Order {
  items_count: number;
  shop_name: string;
}

export interface AdminOrderBuyerSummary {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
}

export interface AdminOrderVendorSummary extends OrderVendorSummary {
  email: string;
}

export interface AdminOrderStatusHistoryEntry {
  id: string;
  order_id: string;
  status: OrderStatus;
  note: string | null;
  created_by: string;
  created_at: Date;
  author_name: string;
  author_role: 'Acheteur' | 'Vendeur' | 'Admin';
}

export interface AdminOrderItemWithStatus {
  id: string;
  order_id: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  offer_id: string | null;
  original_price: number | null;
  product_snapshot: ProductSnapshot;
  product_status: string | null;
}
