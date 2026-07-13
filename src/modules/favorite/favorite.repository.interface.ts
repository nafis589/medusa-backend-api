import type { CreateFavoriteData, Favorite, FavoriteProductRow } from './favorite.entity';

export interface IFavoriteRepository {
  findByUserAndProduct(userId: string, productId: string): Promise<Favorite | null>;
  listProductsForUser(userId: string): Promise<FavoriteProductRow[]>;
  create(data: CreateFavoriteData): Promise<Favorite>;
  delete(userId: string, productId: string): Promise<boolean>;
}
