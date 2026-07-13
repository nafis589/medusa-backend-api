import type { PoolConnection } from 'mysql2/promise';
import type { CreateOfferData, Offer, OfferListRow, OfferStatus } from './offer.entity';

export interface IOfferRepository {
  findById(id: string): Promise<Offer | null>;
  findActiveByBuyerAndProduct(buyerId: string, productId: string): Promise<Offer | null>;
  create(data: CreateOfferData): Promise<Offer>;
  updateStatus(
    id: string,
    status: OfferStatus,
    fields?: { counter_amount?: number | null; amount?: number },
  ): Promise<Offer>;
  listByBuyer(buyerId: string): Promise<OfferListRow[]>;
  listByVendor(vendorId: string): Promise<OfferListRow[]>;
  listByVendorPaginated(
    vendorId: string,
    status: OfferStatus | undefined,
    offset: number,
    limit: number,
  ): Promise<{ rows: OfferListRow[]; total: number }>;
  expireStale(): Promise<void>;
  markConsumed(id: string, connection?: PoolConnection): Promise<void>;
}
