import { AppError } from '@shared/errors/app-error';
import { createProductService } from '@modules/product/product.factory';
import type { ProductStatus } from '@modules/product/product.entity';
import { VendorPublicRepository, type VendorPublicProfile } from './vendor-public.repository';

export class VendorPublicService {
  constructor(
    private readonly repo = new VendorPublicRepository(),
    private readonly productService = createProductService(),
  ) {}

  async getProfile(id: string): Promise<VendorPublicProfile> {
    const profile = await this.repo.findPublicProfile(id);
    if (!profile) {
      throw new AppError(404, 'VENDOR_NOT_FOUND', 'Vendor not found');
    }
    return profile;
  }

  async listProducts(id: string, status: ProductStatus, page: number, limit: number) {
    const vendorId = await this.repo.findActiveVendorId(id);
    if (!vendorId) {
      throw new AppError(404, 'VENDOR_NOT_FOUND', 'Vendor not found');
    }
    return this.productService.listByVendor(vendorId, { status, page, limit });
  }

  getListMeta(total: number, page: number, limit: number) {
    return this.productService.getListMeta(total, page, limit);
  }

  async getFollowStatus(followerId: string, id: string): Promise<{ isFollowing: boolean }> {
    const isFollowing = await this.repo.isFollowing(followerId, id);
    return { isFollowing };
  }

  async follow(
    followerId: string,
    id: string,
  ): Promise<{ isFollowing: boolean; followers_count: number }> {
    const vendorId = await this.repo.findActiveVendorId(id);
    if (!vendorId) {
      throw new AppError(404, 'VENDOR_NOT_FOUND', 'Vendor not found');
    }
    await this.repo.follow(followerId, vendorId);
    const followers_count = await this.repo.countFollowers(vendorId);
    return { isFollowing: true, followers_count };
  }

  async unfollow(
    followerId: string,
    id: string,
  ): Promise<{ isFollowing: boolean; followers_count: number }> {
    await this.repo.unfollow(followerId, id);
    const followers_count = await this.repo.countFollowers(id);
    return { isFollowing: false, followers_count };
  }
}

export function createVendorPublicService(): VendorPublicService {
  return new VendorPublicService();
}
