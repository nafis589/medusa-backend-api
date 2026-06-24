import { eventBus, type OrderCancelledEvent } from '@shared/utils/event-bus';
import { logger } from '@shared/utils/logger';
import { createNotificationService } from '@modules/notification/notification.factory';
import { emitToUser } from '@modules/notification/socket.gateway';
import { formatFcfa, formatOrderRef, getVendorUserId } from './order-notification.helpers';

const notificationService = createNotificationService();

async function handleOrderCancelled({ order }: OrderCancelledEvent): Promise<void> {
  try {
    const vendorUserId = await getVendorUserId(order.vendor_id);
    if (!vendorUserId) {
      logger.warn({ vendorId: order.vendor_id }, 'Vendor user not found for order.cancelled');
      return;
    }

    await notificationService.create(vendorUserId, {
      type: 'ORDER_CANCELLED',
      title: 'Commande annulée',
      body: `La commande ${formatOrderRef(order.id)} a été annulée (${formatFcfa(order.total_amount)}).`,
      metadata: {
        orderId: order.id,
        total: order.total_amount,
      },
    });

    emitToUser(vendorUserId, 'order:cancelled', {
      orderId: order.id,
      total: order.total_amount,
    });
  } catch (err) {
    logger.error(err, 'Failed to handle order.cancelled event');
  }
}

export function registerOrderCancelledSubscriber(): void {
  eventBus.on('order.cancelled', (payload: OrderCancelledEvent) => {
    void handleOrderCancelled(payload);
  });
}
