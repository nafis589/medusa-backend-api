import { eventBus, type OrderStatusChangedEvent } from '@shared/utils/event-bus';
import { logger } from '@shared/utils/logger';
import { createNotificationService } from '@modules/notification/notification.factory';
import { emitToUser } from '@modules/notification/socket.gateway';
import { formatOrderRef, formatOrderStatus } from './order-notification.helpers';

const notificationService = createNotificationService();

async function handleOrderStatusChanged({
  order,
  newStatus,
}: OrderStatusChangedEvent): Promise<void> {
  try {
    await notificationService.create(order.buyer_id, {
      type: 'ORDER_STATUS',
      title: 'Statut de votre commande mis à jour',
      body: `Votre commande ${formatOrderRef(order.id)} est maintenant : ${formatOrderStatus(newStatus)}`,
      metadata: {
        orderId: order.id,
        status: newStatus,
      },
    });

    emitToUser(order.buyer_id, 'order:status_changed', {
      orderId: order.id,
      newStatus,
    });
  } catch (err) {
    logger.error(err, 'Failed to handle order.status_changed event');
  }
}

export function registerOrderStatusChangedSubscriber(): void {
  eventBus.on('order.status_changed', (payload: OrderStatusChangedEvent) => {
    void handleOrderStatusChanged(payload);
  });
}
