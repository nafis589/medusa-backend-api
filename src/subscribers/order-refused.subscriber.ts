import { eventBus, type OrderRefusedEvent } from '@shared/utils/event-bus';
import { logger } from '@shared/utils/logger';
import { createNotificationService } from '@modules/notification/notification.factory';
import { emitToUser } from '@modules/notification/socket.gateway';
import { formatOrderRef } from './order-notification.helpers';

const notificationService = createNotificationService();

async function handleOrderRefused({
  order,
  reason,
  vendorShopName,
}: OrderRefusedEvent): Promise<void> {
  try {
    const ref = formatOrderRef(order.id);
    const body = reason
      ? `Votre commande ${ref} a été refusée par le vendeur : ${reason}`
      : `Votre commande ${ref} a été refusée par le vendeur`;

    await notificationService.create(order.buyer_id, {
      type: 'ORDER_REFUSED',
      title: 'Commande refusée',
      body,
      metadata: {
        orderId: order.id,
        vendorShopName,
        reason: reason ?? null,
      },
    });

    emitToUser(order.buyer_id, 'order:refused', {
      orderId: order.id,
      reason: reason ?? null,
      orderRef: ref,
    });
  } catch (err) {
    logger.error(err, 'Failed to handle order.refused event');
  }
}

export function registerOrderRefusedSubscriber(): void {
  eventBus.on('order.refused', (payload: OrderRefusedEvent) => {
    void handleOrderRefused(payload);
  });
}
