import type {
  OrderStatus,
  PaymentMethod,
  ShippingAddress,
  ShippingMethod,
} from './order.types';

/** Customer order — one per vendor per checkout */
export interface Order {
  id: string;
  buyer_id: string;
  vendor_id: string;
  status: OrderStatus;
  total_amount: number;
  shipping_fee: number;
  payment_method: PaymentMethod;
  shipping_address: ShippingAddress;
  shipping_region_id: string;
  shipping_method: ShippingMethod;
  shipping_distance_km: number | null;
  shipping_detail: string | null;
  tracking_number: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateOrderData {
  id?: string;
  buyer_id: string;
  vendor_id: string;
  status?: OrderStatus;
  total_amount: number;
  shipping_fee: number;
  payment_method?: PaymentMethod;
  shipping_address: ShippingAddress;
  shipping_region_id: string;
  shipping_method: ShippingMethod;
  shipping_distance_km?: number | null;
  shipping_detail?: string | null;
  tracking_number?: string | null;
}
