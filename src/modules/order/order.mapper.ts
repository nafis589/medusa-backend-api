import type { Order } from './order.entity';
import type { AdminOrderDetail, OrderDetail } from './order.service.types';
import type { AdminOrderListRow } from './order.types';

function mapOrder(order: Order & { items_count?: number }) {
  return {
    id: order.id,
    buyer_id: order.buyer_id,
    vendor_id: order.vendor_id,
    status: order.status,
    total_amount: order.total_amount,
    shipping_fee: order.shipping_fee,
    payment_method: order.payment_method,
    shipping_address: order.shipping_address,
    shipping_region_id: order.shipping_region_id,
    shipping_method: order.shipping_method,
    shipping_distance_km: order.shipping_distance_km,
    tracking_number: order.tracking_number,
    created_at: order.created_at,
    updated_at: order.updated_at,
    buyer_name: `${order.shipping_address.first_name} ${order.shipping_address.last_name}`.trim(),
    items_count: order.items_count ?? 0,
  };
}

export function mapOrdersResponse(orders: (Order & { items_count?: number })[]) {
  return orders.map(mapOrder);
}

export function mapAdminOrdersResponse(orders: AdminOrderListRow[]) {
  return orders.map((order) => ({
    ...mapOrder(order),
    shop_name: order.shop_name,
  }));
}

export function mapOrderDetailResponse(detail: OrderDetail) {
  return {
    ...mapOrder(detail.order),
    items: detail.items.map((item) => ({
      id: item.id,
      order_id: item.order_id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      offer_id: item.offer_id,
      original_price: item.original_price,
      product_snapshot: item.product_snapshot,
    })),
    status_history: detail.status_history.map((entry) => ({
      id: entry.id,
      order_id: entry.order_id,
      status: entry.status,
      note: entry.note,
      created_by: entry.created_by,
      created_at: entry.created_at,
    })),
    vendor: detail.vendor,
  };
}

export function mapAdminOrderDetailResponse(detail: AdminOrderDetail) {
  return {
    ...mapOrder(detail.order),
    items: detail.items.map((item) => ({
      id: item.id,
      order_id: item.order_id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      offer_id: item.offer_id,
      original_price: item.original_price,
      product_snapshot: item.product_snapshot,
      product_status: item.product_status,
    })),
    status_history: detail.status_history.map((entry) => ({
      id: entry.id,
      order_id: entry.order_id,
      status: entry.status,
      note: entry.note,
      created_by: entry.created_by,
      created_at: entry.created_at,
      author_name: entry.author_name,
      author_role: entry.author_role,
    })),
    vendor: detail.vendor,
    buyer: detail.buyer,
  };
}
