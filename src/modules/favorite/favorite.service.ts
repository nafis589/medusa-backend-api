import { randomUUID } from 'crypto';
import { AppError } from '@shared/errors/app-error';
import type { IProductRepository } from '@modules/product/product.repository.interface';
import type { IFavoriteRepository } from './favorite.repository.interface';
import { serializeFavoriteProduct } from './favorite.mapper';

export class FavoriteService {
  constructor(
    private readonly favoriteRepo: IFavoriteRepository,
    private readonly productRepo: IProductRepository,
  ) {}

  async list(userId: string) {
    const rows = await this.favoriteRepo.listProductsForUser(userId);
    return rows.map(serializeFavoriteProduct);
  }

  async add(userId: string, productId: string) {
    const product = await this.productRepo.findById(productId);
    if (!product || product.status !== 'ACTIVE') {
      throw new AppError(404, 'NOT_FOUND', 'Product not found');
    }

    const existing = await this.favoriteRepo.findByUserAndProduct(userId, productId);
    if (existing) {
      throw new AppError(409, 'ALREADY_FAVORITE', 'Product is already in favorites');
    }

    await this.favoriteRepo.create({
      id: randomUUID(),
      user_id: userId,
      product_id: productId,
    });

    return { product_id: productId };
  }

  async remove(userId: string, productId: string): Promise<void> {
    const deleted = await this.favoriteRepo.delete(userId, productId);
    if (!deleted) {
      throw new AppError(404, 'NOT_FOUND', 'Favorite not found');
    }
  }
}
