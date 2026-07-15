import { eventBus, type OrderCancelledEvent } from '@shared/utils/event-bus';
import { logger } from '@shared/utils/logger';
import { createNotificationService } from '@modules/notification/notification.factory';
import { emitToUser } from '@modules/notification/socket.gateway';
import { formatFcfa, formatOrderRef, getVendorUserId } from './order-notification.helpers';

const notificationService = createNotificationService();

async function handleOrderCancelled({
  order,
  reason,
  cancelledBy,
}: OrderCancelledEvent): Promise<void> {
  try {
    const ref = formatOrderRef(order.id);
    const vendorUserId = await getVendorUserId(order.vendor_id);

    if (cancelledBy === 'admin') {
      await notificationService.create(order.buyer_id, {
        type: 'ORDER_CANCELLED',
        title: 'Commande annulée',
        body: reason
          ? `Votre commande ${ref} a été annulée par l'administration. Raison : ${reason}`
          : `Votre commande ${ref} a été annulée par l'administration.`,
        metadata: { orderId: order.id, total: order.total_amount },
      });
      emitToUser(order.buyer_id, 'order:cancelled', {
        orderId: order.id,
        total: order.total_amount,
      });
    }

    if (vendorUserId) {
      const vendorBody =
        cancelledBy === 'admin' && reason
          ? `La commande ${ref} a été annulée par l'administration (${formatFcfa(order.total_amount)}). Raison : ${reason}`
          : `La commande ${ref} a été annulée (${formatFcfa(order.total_amount)}).`;

      await notificationService.create(vendorUserId, {
        type: 'ORDER_CANCELLED',
        title: 'Commande annulée',
        body: vendorBody,
        metadata: {
          orderId: order.id,
          total: order.total_amount,
        },
      });

      emitToUser(vendorUserId, 'order:cancelled', {
        orderId: order.id,
        total: order.total_amount,
      });
    } else {
      logger.warn({ vendorId: order.vendor_id }, 'Vendor user not found for order.cancelled');
    }
  } catch (err) {
    logger.error(err, 'Failed to handle order.cancelled event');
  }
}

export function registerOrderCancelledSubscriber(): void {
  eventBus.on('order.cancelled', (payload: OrderCancelledEvent) => {
    void handleOrderCancelled(payload);
  });
}
