import { ProductRepository } from '@modules/product/product.repository';
import { FavoriteRepository } from './favorite.repository';
import { FavoriteService } from './favorite.service';

export function createFavoriteService(): FavoriteService {
  return new FavoriteService(new FavoriteRepository(), new ProductRepository());
}
