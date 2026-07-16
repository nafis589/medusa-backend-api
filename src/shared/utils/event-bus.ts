import { EventEmitter } from 'events';
import type { Order } from '@modules/order/order.entity';
import type { OrderStatus } from '@modules/order/order.types';

export interface OrderPlacedEvent {
  order: Order;
}

export interface OrderRefusedEvent {
  order: Order;
  reason?: string;
  vendorShopName: string;
}

export interface OrderCancelledEvent {
  order: Order;
  reason?: string;
  cancelledBy?: 'buyer' | 'admin';
}

export interface OrderStatusChangedEvent {
  order: Order;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  note?: string | null;
}

export interface OfferEventPayload {
  offerId: string;
  productId: string;
  productTitle: string;
  buyerId: string;
  vendorId: string;
  amount: number;
  counterAmount?: number | null;
  /** Who should receive the in-app + socket notification */
  recipient: 'buyer' | 'vendor';
}

class AppEventBus extends EventEmitter {
  emitOrderPlaced(payload: OrderPlacedEvent): void {
    this.emit('order.placed', payload);
  }

  emitOrderCancelled(payload: OrderCancelledEvent): void {
    this.emit('order.cancelled', payload);
  }

  emitOrderRefused(payload: OrderRefusedEvent): void {
    this.emit('order.refused', payload);
  }

  emitOrderStatusChanged(payload: OrderStatusChangedEvent): void {
    this.emit('order.status_changed', payload);
  }

  emitOfferNew(payload: OfferEventPayload): void {
    this.emit('offer.new', payload);
  }

  emitOfferAccepted(payload: OfferEventPayload): void {
    this.emit('offer.accepted', payload);
  }

  emitOfferDeclined(payload: OfferEventPayload): void {
    this.emit('offer.declined', payload);
  }

  emitOfferCounter(payload: OfferEventPayload): void {
    this.emit('offer.counter', payload);
  }
}

export const eventBus = new AppEventBus();
