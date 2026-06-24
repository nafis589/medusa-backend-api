import { eventBus, type OrderPlacedEvent } from '@shared/utils/event-bus';
import { logger } from '@shared/utils/logger';
import { createNotificationService } from '@modules/notification/notification.factory';
import { emitToUser } from '@modules/notification/socket.gateway';
import {
  formatFcfa,
  getBuyerDisplayName,
  getVendorUserId,
} from './order-notification.helpers';

const notificationService = createNotificationService();

async function handleOrderPlaced({ order }: OrderPlacedEvent): Promise<void> {
  try {
    const vendorUserId = await getVendorUserId(order.vendor_id);
    if (!vendorUserId) {
      logger.warn({ vendorId: order.vendor_id }, 'Vendor user not found for order.placed');
      return;
    }

    const buyerName = await getBuyerDisplayName(order.buyer_id);

    const notification = await notificationService.create(vendorUserId, {
      type: 'ORDER_NEW',
      title: 'Nouvelle commande reçue',
      body: `Vous avez reçu une commande de ${buyerName} pour ${formatFcfa(order.total_amount)}`,
      metadata: {
        orderId: order.id,
        total: order.total_amount,
        buyerId: order.buyer_id,
      },
    });

    emitToUser(vendorUserId, 'order:new', {
      orderId: order.id,
      total: order.total_amount,
      buyerName,
      vendorId: order.vendor_id,
      notificationId: notification.id,
    });
  } catch (err) {
    logger.error(err, 'Failed to handle order.placed event');
  }
}

export function registerOrderPlacedSubscriber(): void {
  eventBus.on('order.placed', (payload: OrderPlacedEvent) => {
    void handleOrderPlaced(payload);
  });
}
