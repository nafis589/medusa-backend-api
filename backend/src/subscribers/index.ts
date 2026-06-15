import { registerOrderPlacedSubscriber } from './order-placed.subscriber';
import { registerOrderStatusChangedSubscriber } from './order-status-changed.subscriber';
import { registerOrderCancelledSubscriber } from './order-cancelled.subscriber';

let registered = false;

export function registerSubscribers(): void {
  if (registered) return;
  registered = true;

  registerOrderPlacedSubscriber();
  registerOrderStatusChangedSubscriber();
  registerOrderCancelledSubscriber();
}
