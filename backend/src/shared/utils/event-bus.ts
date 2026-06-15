import { EventEmitter } from 'events';
import type { Order } from '@modules/order/order.entity';
import type { OrderStatus } from '@modules/order/order.types';

export interface OrderPlacedEvent {
  order: Order;
}

export interface OrderCancelledEvent {
  order: Order;
}

export interface OrderStatusChangedEvent {
  order: Order;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  note?: string | null;
}

class AppEventBus extends EventEmitter {
  emitOrderPlaced(payload: OrderPlacedEvent): void {
    this.emit('order.placed', payload);
  }

  emitOrderCancelled(payload: OrderCancelledEvent): void {
    this.emit('order.cancelled', payload);
  }

  emitOrderStatusChanged(payload: OrderStatusChangedEvent): void {
    this.emit('order.status_changed', payload);
  }
}

export const eventBus = new AppEventBus();
