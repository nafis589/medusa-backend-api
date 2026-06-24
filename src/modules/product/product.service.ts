import { randomUUID } from 'crypto';
import { AppError } from '@shared/errors/app-error';
import { uploadImage } from '@shared/utils/cloudinary.util';
import { sendMail } from '@shared/utils/mail';
import { getPagination, getPaginationMeta } from '@shared/utils/pagination';
import type { ICategoryRepository } from '@modules/category/category.repository.interface';
import type { Product, ProductStatus, UpdateProductData } from './product.entity';
import type { IProductImageRepository } from './product-image.repository.interface';
import type { IProductRepository } from './product.repository.interface';
import type {
  AdminProductListFilters,
  CreateProductInput,
  ProductDetail,
  ProductListFilters,
  ProductListItem,
  UpdateProductInput,
  VendorProductDetail,
  ProductFilterFacets,
} from './product.types';

const CONDITION_LABELS: Record<string, string> = {
  NEW: 'Neuf',
  VERY_GOOD: 'Très bon état',
  GOOD: 'Bon état',
  FAIR: 'Satisfaisant',
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ProductService {
  constructor(
    private readonly productRepo: IProductRepository,
    private readonly productImageRepo: IProductImageRepository,
    private readonly categoryRepo: ICategoryRepository,
  ) {}

  // ── Private helpers ────────────────────────────────────────────────────────

  private async resolveCategorySlug(slug: string, label: string): Promise<string> {
    const category = await this.categoryRepo.findBySlug(slug);
    if (!category) {
      throw new AppError(404, 'NOT_FOUND', `Category '${label}' not found`);
    }
    return category.id;
  }

  private async resolveCategoryId(filters: ProductListFilters): Promise<string | undefined> {
    if (filters.subcategory) {
      return this.resolveCategorySlug(filters.subcategory, filters.subcategory);
    }
    if (filters.category) {
      if (UUID_RE.test(filters.category)) {
        return filters.category;
      }
      return this.resolveCategorySlug(filters.category, filters.category);
    }
    return filters.category_id;
  }

  private buildListQuery(filters: ProductListFilters, options?: {
    status?: ProductStatus | 'ACTIVE';
    vendor_id?: string;
    skipStatusFilter?: boolean;
  }) {
    const limit = Math.min(50, Math.max(1, Math.floor(filters.limit ?? 24)));
    const page = filters.page ?? 1;
    const { offset } = getPagination(page, limit);

    return {
      query: {
        category_id: undefined as string | undefined,
        condition: filters.condition,
        color: filters.color,
        size: filters.size,
        material: filters.material,
        brand: filters.brand,
        price_min: filters.price_min,
        price_max: filters.price_max,
        sort: filters.sort ?? 'newest',
        offset,
        limit,
        status: options?.status,
        vendor_id: options?.vendor_id,
        skipStatusFilter: options?.skipStatusFilter,
        ids: filters.ids
          ? filters.ids.split(',').map((id) => id.trim()).filter(Boolean)
          : undefined,
        tag: filters.tag,
      },
      page,
      limit,
    };
  }

  private async assertOwnership(productId: string, vendorId: string): Promise<Product> {
    const product = await this.productRepo.findById(productId);
    if (!product) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
    }
    if (product.vendor_id !== vendorId) {
      throw AppError.forbidden('You do not own this product');
    }
    return product;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async list(
    filters: ProductListFilters = {},
  ): Promise<{ products: ProductListItem[]; total: number; page: number; limit: number }> {
    const { query, page, limit } = this.buildListQuery(filters, { status: 'ACTIVE' });

    let category_ids = filters.category_ids;
    if (!category_ids?.length) {
      const category_id = await this.resolveCategoryId(filters);
      if (category_id) {
        category_ids = await this.categoryRepo.findDescendantIds(category_id);
      }
    }

    const result = await this.productRepo.list({
      ...query,
      category_ids: category_ids?.length ? category_ids : undefined,
    });
    return { ...result, page, limit };
  }

  async listByVendor(
    vendorId: string,
    filters: ProductListFilters & { status?: ProductStatus } = {},
  ): Promise<{ products: ProductListItem[]; total: number; page: number; limit: number }> {
    const category_id = await this.resolveCategoryId(filters);
    const { query, page, limit } = this.buildListQuery(filters, {
      vendor_id: vendorId,
      skipStatusFilter: !filters.status,
      status: filters.status,
    });
    const result = await this.productRepo.list({
      ...query,
      category_id: filters.category_id ?? category_id,
      search: filters.search,
    });
    return { ...result, page, limit };
  }

  async listForAdmin(
    filters: AdminProductListFilters = {},
  ): Promise<{ products: ProductListItem[]; total: number; page: number; limit: number }> {
    const category_id = await this.resolveCategoryId(filters);
    const { query, page, limit } = this.buildListQuery(filters, {
      skipStatusFilter: !filters.status,
      status: filters.status,
    });
    const result = await this.productRepo.list({ ...query, category_id, search: filters.search });
    return { ...result, page, limit };
  }

  async search(
    q: string,
    page = 1,
    limit = 24,
    filters: ProductListFilters = {},
  ): Promise<{ products: ProductListItem[]; total: number; page: number; limit: number }> {
    const safeLimit = Math.min(50, Math.max(1, Math.floor(limit)));
    const { offset } = getPagination(page, safeLimit);
    const result = await this.productRepo.search(
      q,
      offset,
      safeLimit,
      {
        condition: filters.condition,
        color: filters.color,
        size: filters.size,
        material: filters.material,
        brand: filters.brand,
        price_min: filters.price_min,
        price_max: filters.price_max,
      },
      filters.sort ?? 'newest',
    );
    return { ...result, page, limit: safeLimit };
  }

  async searchSuggest(q: string, limit = 8) {
    return this.productRepo.searchSuggest(q, limit);
  }

  async getPopularSearchTerms(limit = 8) {
    return this.productRepo.getPopularSearchTerms(limit);
  }

  async getSearchFilters(q: string): Promise<ProductFilterFacets> {
    const facets = await this.productRepo.getFilterFacets({
      fulltext_q: q.trim(),
      sort: 'newest',
      offset: 0,
      limit: 1,
      status: 'ACTIVE',
    });

    return {
      ...facets,
      conditions: facets.conditions.map((option) => ({
        ...option,
        label: CONDITION_LABELS[option.value] ?? option.value,
      })),
    };
  }

  async getTrending(): Promise<ProductListItem[]> {
    return this.productRepo.findTrending(10);
  }

  async getFilters(filters: ProductListFilters = {}): Promise<ProductFilterFacets> {
    let category_ids = filters.category_ids;
    if (!category_ids?.length) {
      const category_id = await this.resolveCategoryId(filters);
      if (category_id) {
        category_ids = await this.categoryRepo.findDescendantIds(category_id);
      }
    }

    const facets = await this.productRepo.getFilterFacets({
      category_ids: category_ids?.length ? category_ids : undefined,
      tag: filters.tag,
      sort: 'newest',
      offset: 0,
      limit: 1,
      status: 'ACTIVE',
    });

    return {
      ...facets,
      conditions: facets.conditions.map((option) => ({
        ...option,
        label: CONDITION_LABELS[option.value] ?? option.value,
      })),
    };
  }

  async findById(id: string): Promise<ProductDetail> {
    const detail = await this.productRepo.findDetailById(id);
    // SOLD products stay reachable by direct URL (e.g. vendor profile links);
    // only ACTIVE and SOLD are publicly viewable — drafts/pending/archived/rejected 404.
    const PUBLICLY_VIEWABLE: ProductStatus[] = ['ACTIVE', 'SOLD'];
    if (!detail || !PUBLICLY_VIEWABLE.includes(detail.product.status)) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
    }

    void this.incrementViews(id);

    return {
      ...detail.product,
      images: detail.images,
      vendor: detail.vendor,
      reviews: detail.reviews,
      vendor_region: detail.vendor_region,
      category_path: detail.category_path,
    };
  }

  async create(vendorId: string, data: CreateProductInput): Promise<Product> {
    const productId = randomUUID();
    const uploadedUrls = await Promise.all(
      data.images.map((source) => uploadImage(source)),
    );

    const initialStatus =
      data.status === 'DRAFT' ? 'DRAFT' : ('PENDING_REVIEW' as ProductStatus);

    const product = await this.productRepo.create({
      id: productId,
      vendor_id: vendorId,
      title: data.title,
      description: data.description ?? null,
      price: data.price,
      category_id: data.category_id ?? null,
      brand: data.brand ?? null,
      condition: data.condition ?? null,
      material: data.material ?? null,
      color: data.color ?? null,
      size: data.size ?? null,
      status: initialStatus,
      stock: data.stock ?? 1,
    });

    if (uploadedUrls.length > 0) {
      await this.productImageRepo.createMany(
        uploadedUrls.map((url, index) => ({
          id: randomUUID(),
          product_id: productId,
          url,
          position: index,
          is_primary: index === 0,
        })),
      );
    }

    return product;
  }

  async update(id: string, vendorId: string, data: UpdateProductInput): Promise<Product> {
    await this.assertOwnership(id, vendorId);

    const { images, status, stock, ...fields } = data;
    const updatePayload: UpdateProductData = { ...fields };
    if (status !== undefined) updatePayload.status = status;
    if (stock !== undefined) updatePayload.stock = stock;

    if (Object.keys(updatePayload).length > 0) {
      await this.productRepo.update(id, updatePayload);
    }

    if (images && images.length > 0) {
      const uploadedUrls = await Promise.all(images.map((source) => uploadImage(source)));
      await this.productImageRepo.deleteByProductId(id);
      await this.productImageRepo.createMany(
        uploadedUrls.map((url, index) => ({
          id: randomUUID(),
          product_id: id,
          url,
          position: index,
          is_primary: index === 0,
        })),
      );
    }

    const updated = await this.productRepo.findById(id);
    if (!updated) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
    }
    return updated;
  }

  async delete(id: string, vendorId: string): Promise<void> {
    await this.assertOwnership(id, vendorId);
    await this.productRepo.updateStatus(id, 'ARCHIVED');
  }

  async toggleStatus(id: string, vendorId: string): Promise<Product> {
    const product = await this.assertOwnership(id, vendorId);

    if (product.status === 'ACTIVE') {
      return this.productRepo.updateStatus(id, 'DRAFT');
    }

    if (product.status === 'DRAFT') {
      return this.productRepo.updateStatus(id, 'ACTIVE');
    }

    throw new AppError(
      400,
      'INVALID_STATUS',
      'Only ACTIVE or DRAFT products can be toggled',
    );
  }

  async findVendorProduct(id: string, vendorId: string): Promise<VendorProductDetail> {
    const product = await this.assertOwnership(id, vendorId);
    const images = await this.productImageRepo.findByProductId(id);
    return { ...product, images };
  }

  async approve(id: string): Promise<Product> {
    const product = await this.productRepo.findById(id);
    if (!product) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
    }
    if (product.status !== 'PENDING_REVIEW') {
      throw new AppError(400, 'INVALID_STATUS', 'Only PENDING_REVIEW products can be approved');
    }
    return this.productRepo.updateStatus(id, 'ACTIVE');
  }

  async reject(id: string, reason: string): Promise<Product> {
    const product = await this.productRepo.findById(id);
    if (!product) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
    }
    if (product.status !== 'PENDING_REVIEW') {
      throw new AppError(400, 'INVALID_STATUS', 'Only PENDING_REVIEW products can be rejected');
    }

    const updated = await this.productRepo.updateStatus(id, 'REJECTED');
    const contact = await this.productRepo.findVendorContactByProductId(id);

    if (contact) {
      void sendMail({
        to: contact.email,
        subject: `Produit refusé — ${contact.product_title}`,
        text: `Bonjour ${contact.shop_name},\n\nVotre produit "${contact.product_title}" a été refusé.\n\nRaison : ${reason}\n\nVous pouvez le modifier et le soumettre à nouveau depuis votre tableau de bord.`,
        html: `<p>Bonjour <strong>${contact.shop_name}</strong>,</p>
<p>Votre produit <strong>${contact.product_title}</strong> a été refusé.</p>
<p><strong>Raison :</strong> ${reason}</p>
<p>Vous pouvez le modifier et le soumettre à nouveau depuis votre tableau de bord.</p>`,
      });
    }

    return updated;
  }

  async incrementViews(id: string): Promise<void> {
    await this.productRepo.incrementViews(id);
  }

  /** Builds pagination meta for API responses */
  getListMeta(total: number, page: number, limit: number) {
    return getPaginationMeta(total, page, limit);
  }
}
