import { eventBus, type OfferEventPayload } from '@shared/utils/event-bus';
import { logger } from '@shared/utils/logger';
import { createNotificationService } from '@modules/notification/notification.factory';
import { emitToUser } from '@modules/notification/socket.gateway';
import {
  formatFcfa,
  getBuyerDisplayName,
  getProductPrimaryImage,
  getVendorUserId,
} from './order-notification.helpers';

const notificationService = createNotificationService();

async function notifyUser(
  userId: string,
  type: string,
  title: string,
  body: string,
  socketEvent: string,
  payload: OfferEventPayload,
): Promise<void> {
  const productImage = await getProductPrimaryImage(payload.productId);
  const notification = await notificationService.create(userId, {
    type,
    title,
    body,
    metadata: {
      offerId: payload.offerId,
      productId: payload.productId,
      product_image: productImage,
      amount: payload.amount,
      counterAmount: payload.counterAmount ?? null,
    },
  });

  emitToUser(userId, socketEvent, {
    offerId: payload.offerId,
    productId: payload.productId,
    productTitle: payload.productTitle,
    amount: payload.amount,
    counterAmount: payload.counterAmount ?? null,
    notificationId: notification.id,
  });
}

async function dispatch(payload: OfferEventPayload, title: string, body: string, socketEvent: string, notifType: string): Promise<void> {
  try {
    if (payload.recipient === 'vendor') {
      const vendorUserId = await getVendorUserId(payload.vendorId);
      if (!vendorUserId) return;
      await notifyUser(vendorUserId, notifType, title, body, socketEvent, payload);
      return;
    }
    await notifyUser(payload.buyerId, notifType, title, body, socketEvent, payload);
  } catch (err) {
    logger.error(err, 'Failed to handle offer event');
  }
}

async function handleOfferNew(payload: OfferEventPayload): Promise<void> {
  const buyerName = await getBuyerDisplayName(payload.buyerId);
  await dispatch(
    payload,
    'Nouvelle offre reçue',
    `${buyerName} propose ${formatFcfa(payload.amount)} pour « ${payload.productTitle} »`,
    'offer:new',
    'OFFER_NEW',
  );
}

async function handleOfferAccepted(payload: OfferEventPayload): Promise<void> {
  const finalAmount = payload.counterAmount ?? payload.amount;
  const title = payload.recipient === 'vendor' ? 'Contre-offre acceptée' : 'Offre acceptée';
  const body =
    payload.recipient === 'vendor'
      ? `L'acheteur a accepté votre contre-offre de ${formatFcfa(finalAmount)} pour « ${payload.productTitle} »`
      : `Votre offre sur « ${payload.productTitle} » a été acceptée à ${formatFcfa(finalAmount)}`;
  await dispatch(payload, title, body, 'offer:accepted', 'OFFER_ACCEPTED');
}

async function handleOfferDeclined(payload: OfferEventPayload): Promise<void> {
  const title = payload.recipient === 'vendor' ? 'Contre-offre refusée' : 'Offre refusée';
  const body =
    payload.recipient === 'vendor'
      ? `L'acheteur a refusé votre contre-offre pour « ${payload.productTitle} »`
      : `Votre offre sur « ${payload.productTitle} » a été refusée`;
  await dispatch(payload, title, body, 'offer:declined', 'OFFER_DECLINED');
}

async function handleOfferCounter(payload: OfferEventPayload): Promise<void> {
  const counter = payload.counterAmount ?? payload.amount;
  await dispatch(
    payload,
    'Contre-offre reçue',
    `Le vendeur propose ${formatFcfa(counter)} pour « ${payload.productTitle} »`,
    'offer:counter',
    'OFFER_COUNTER',
  );
}

export function registerOfferEventsSubscriber(): void {
  eventBus.on('offer.new', (payload: OfferEventPayload) => {
    void handleOfferNew(payload);
  });
  eventBus.on('offer.accepted', (payload: OfferEventPayload) => {
    void handleOfferAccepted(payload);
  });
  eventBus.on('offer.declined', (payload: OfferEventPayload) => {
    void handleOfferDeclined(payload);
  });
  eventBus.on('offer.counter', (payload: OfferEventPayload) => {
    void handleOfferCounter(payload);
  });
}
