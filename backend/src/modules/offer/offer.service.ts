import { randomUUID } from 'crypto';
import { AppError } from '@shared/errors/app-error';
import { eventBus } from '@shared/utils/event-bus';
import type { IProductRepository } from '@modules/product/product.repository.interface';
import { findVendorIdByUserId } from '@modules/vendor/vendor.util';
import type { IOfferRepository } from './offer.repository.interface';
import type { Offer, OfferListRow } from './offer.entity';
import { mapOfferResponse, mapOffersResponse, type OfferResponse } from './offer.mapper';

const OFFER_TTL_MS = 48 * 60 * 60 * 1000;

function emitOfferEvent(
  type: 'new' | 'accepted' | 'declined' | 'counter',
  offer: Offer,
  productTitle: string,
  recipient: 'buyer' | 'vendor',
): void {
  const payload = {
    offerId: offer.id,
    productId: offer.product_id,
    productTitle,
    buyerId: offer.buyer_id,
    vendorId: offer.vendor_id,
    amount: offer.amount,
    counterAmount: offer.counter_amount,
    recipient,
  };

  switch (type) {
    case 'new':
      eventBus.emitOfferNew(payload);
      break;
    case 'accepted':
      eventBus.emitOfferAccepted(payload);
      break;
    case 'declined':
      eventBus.emitOfferDeclined(payload);
      break;
    case 'counter':
      eventBus.emitOfferCounter(payload);
      break;
  }
}

export class OfferService {
  constructor(
    private readonly offerRepo: IOfferRepository,
    private readonly productRepo: IProductRepository,
  ) {}

  async createOffer(buyerId: string, productId: string, amount: number): Promise<OfferResponse> {
    await this.offerRepo.expireStale();

    const product = await this.productRepo.findById(productId);
    if (!product || product.status !== 'ACTIVE') {
      throw new AppError(400, 'PRODUCT_NOT_AVAILABLE', 'Product is not available');
    }

    const buyerVendorId = await findVendorIdByUserId(buyerId);
    if (buyerVendorId && buyerVendorId === product.vendor_id) {
      throw new AppError(
        403,
        'CANNOT_OFFER_OWN_PRODUCT',
        'Vous ne pouvez pas faire une offre sur vos propres articles.',
      );
    }

    if (amount >= product.price) {
      throw new AppError(
        400,
        'OFFER_TOO_HIGH',
        'Ce montant atteint ou dépasse le prix. Achetez directement.',
      );
    }

    const existing = await this.offerRepo.findActiveByBuyerAndProduct(buyerId, productId);
    if (existing) {
      throw new AppError(
        409,
        'OFFER_ALREADY_PENDING',
        'Vous avez déjà une offre en cours sur cet article.',
      );
    }

    const expiresAt = new Date(Date.now() + OFFER_TTL_MS);
    const offer = await this.offerRepo.create({
      id: randomUUID(),
      product_id: productId,
      buyer_id: buyerId,
      vendor_id: product.vendor_id,
      amount,
      expires_at: expiresAt,
    });

    emitOfferEvent('new', offer, product.title, 'vendor');

    const rows = await this.offerRepo.listByBuyer(buyerId);
    const row = rows.find((r) => r.id === offer.id)!;
    return mapOfferResponse(row);
  }

  async listForBuyer(buyerId: string): Promise<OfferResponse[]> {
    await this.offerRepo.expireStale();
    const rows = await this.offerRepo.listByBuyer(buyerId);
    return mapOffersResponse(rows);
  }

  async listForVendor(vendorId: string): Promise<OfferResponse[]> {
    await this.offerRepo.expireStale();
    const rows = await this.offerRepo.listByVendor(vendorId);
    return mapOffersResponse(rows);
  }

  private async getOfferRowForVendor(offerId: string, vendorId: string): Promise<OfferListRow> {
    await this.offerRepo.expireStale();
    const rows = await this.offerRepo.listByVendor(vendorId);
    const row = rows.find((r) => r.id === offerId);
    if (!row) {
      throw new AppError(404, 'OFFER_NOT_FOUND', 'Offer not found');
    }
    return row;
  }

  private async getOfferRowForBuyer(offerId: string, buyerId: string): Promise<OfferListRow> {
    await this.offerRepo.expireStale();
    const rows = await this.offerRepo.listByBuyer(buyerId);
    const row = rows.find((r) => r.id === offerId);
    if (!row) {
      throw new AppError(404, 'OFFER_NOT_FOUND', 'Offer not found');
    }
    return row;
  }

  async vendorAccept(offerId: string, vendorId: string): Promise<OfferResponse> {
    const row = await this.getOfferRowForVendor(offerId, vendorId);
    if (row.status !== 'PENDING') {
      throw new AppError(400, 'INVALID_OFFER_STATUS', 'Only pending offers can be accepted');
    }
    const updated = await this.offerRepo.updateStatus(offerId, 'ACCEPTED');
    emitOfferEvent('accepted', updated, row.product_title, 'buyer');
    return mapOfferResponse({ ...row, ...updated });
  }

  async vendorDecline(offerId: string, vendorId: string): Promise<OfferResponse> {
    const row = await this.getOfferRowForVendor(offerId, vendorId);
    if (row.status !== 'PENDING') {
      throw new AppError(400, 'INVALID_OFFER_STATUS', 'Only pending offers can be declined');
    }
    const updated = await this.offerRepo.updateStatus(offerId, 'DECLINED');
    emitOfferEvent('declined', updated, row.product_title, 'buyer');
    return mapOfferResponse({ ...row, ...updated });
  }

  async vendorCounter(
    offerId: string,
    vendorId: string,
    counterAmount: number,
  ): Promise<OfferResponse> {
    const row = await this.getOfferRowForVendor(offerId, vendorId);
    if (row.status !== 'PENDING') {
      throw new AppError(400, 'INVALID_OFFER_STATUS', 'Only pending offers can be countered');
    }
    if (counterAmount <= row.amount) {
      throw new AppError(
        400,
        'COUNTER_TOO_LOW',
        'La contre-offre doit être supérieure à l\'offre de l\'acheteur.',
      );
    }
    if (counterAmount >= row.product_price) {
      throw new AppError(
        400,
        'COUNTER_TOO_HIGH',
        'La contre-offre doit être inférieure au prix affiché.',
      );
    }
    const updated = await this.offerRepo.updateStatus(offerId, 'COUNTER', {
      counter_amount: counterAmount,
    });
    emitOfferEvent('counter', updated, row.product_title, 'buyer');
    return mapOfferResponse({ ...row, ...updated, counter_amount: counterAmount });
  }

  async buyerAcceptCounter(offerId: string, buyerId: string): Promise<OfferResponse> {
    const row = await this.getOfferRowForBuyer(offerId, buyerId);
    if (row.status !== 'COUNTER' || row.counter_amount == null) {
      throw new AppError(400, 'INVALID_OFFER_STATUS', 'No counter offer to accept');
    }
    const updated = await this.offerRepo.updateStatus(offerId, 'ACCEPTED', {
      amount: row.counter_amount,
    });
    emitOfferEvent('accepted', updated, row.product_title, 'vendor');
    return mapOfferResponse({ ...row, ...updated, amount: row.counter_amount, status: 'ACCEPTED' });
  }

  async buyerDeclineCounter(offerId: string, buyerId: string): Promise<OfferResponse> {
    const row = await this.getOfferRowForBuyer(offerId, buyerId);
    if (row.status !== 'COUNTER') {
      throw new AppError(400, 'INVALID_OFFER_STATUS', 'No counter offer to decline');
    }
    const updated = await this.offerRepo.updateStatus(offerId, 'DECLINED');
    emitOfferEvent('declined', updated, row.product_title, 'vendor');
    return mapOfferResponse({ ...row, ...updated, status: 'DECLINED' });
  }
}
