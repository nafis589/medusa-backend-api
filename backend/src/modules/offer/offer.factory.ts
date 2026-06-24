import { OfferRepository } from './offer.repository';
import { OfferService } from './offer.service';
import { ProductRepository } from '@modules/product/product.repository';

export function createOfferService(): OfferService {
  return new OfferService(new OfferRepository(), new ProductRepository());
}
