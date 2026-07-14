/* eslint-disable @typescript-eslint/unbound-method */
import { ProductService } from '../product.service';
import type { ICategoryRepository } from '@modules/category/category.repository.interface';
import type { Product } from '../product.entity';
import type { ProductImage } from '../product-image.entity';
import type { IProductImageRepository } from '../product-image.repository.interface';
import type { IProductRepository, ProductDetailRow } from '../product.repository.interface';
function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    vendor_id: 'vendor-1',
    title: 'Robe wax',
    description: 'Belle robe',
    price: 15000,
    category_id: 'cat-1',
    brand: 'Local',
    condition: 'VERY_GOOD',
    material: 'Coton',
    color: 'Rouge',
    size: 'M',
    status: 'ACTIVE',
    stock: 1,
    views_count: 10,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeImage(overrides: Partial<ProductImage> = {}): ProductImage {
  return {
    id: 'img-1',
    product_id: 'prod-1',
    url: 'https://example.com/img.jpg',
    position: 0,
    is_primary: true,
    ...overrides,
  };
}

function buildProductRepo(overrides: Partial<IProductRepository> = {}): IProductRepository {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findActiveById: jest.fn().mockResolvedValue(null),
    findDetailById: jest.fn().mockResolvedValue(null),
    list: jest.fn().mockResolvedValue({ products: [], total: 0 }),
    search: jest.fn().mockResolvedValue({ products: [], total: 0 }),
    findTrending: jest.fn().mockResolvedValue([]),
    findVendorContactByProductId: jest.fn().mockResolvedValue(null),
    findCategoryNameById: jest.fn().mockResolvedValue(null),
    countOrdersByProductId: jest.fn().mockResolvedValue(0),
    findAdminDetailById: jest.fn().mockResolvedValue(null),
    deletePermanent: jest.fn().mockResolvedValue(undefined),
    create: jest.fn().mockImplementation((data) =>
      Promise.resolve(makeProduct({ id: data.id, vendor_id: data.vendor_id, ...data })),
    ),
    update: jest.fn().mockImplementation((id, data) =>
      Promise.resolve(makeProduct({ id, ...data })),
    ),
    updateStatus: jest.fn().mockImplementation((id, status) =>
      Promise.resolve(makeProduct({ id, status })),
    ),
    incrementViews: jest.fn().mockResolvedValue(undefined),
    findByIdForUpdate: jest.fn().mockResolvedValue(null),
    decrementStock: jest.fn().mockResolvedValue(undefined),
    incrementStock: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function buildImageRepo(overrides: Partial<IProductImageRepository> = {}): IProductImageRepository {
  return {
    findByProductId: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    createMany: jest.fn().mockResolvedValue([]),
    deleteByProductId: jest.fn(),
    ...overrides,
  };
}

function buildCategoryRepo(overrides: Partial<ICategoryRepository> = {}): ICategoryRepository {
  return {
    findAll: jest.fn(),
    findById: jest.fn(),
    findBySlug: jest.fn().mockResolvedValue(null),
    isSlugTaken: jest.fn(),
    countProducts: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findDescendantIds: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function buildService(
  productRepo: Partial<IProductRepository> = {},
  imageRepo: Partial<IProductImageRepository> = {},
  categoryRepo: Partial<ICategoryRepository> = {},
): ProductService {
  return new ProductService(
    buildProductRepo(productRepo),
    buildImageRepo(imageRepo),
    buildCategoryRepo(categoryRepo),
  );
}

describe('ProductService', () => {
  describe('list', () => {
    it('returns only ACTIVE products with pagination capped at 50', async () => {
      const list = jest.fn().mockResolvedValue({ products: [], total: 0 });
      const svc = buildService({ list });

      await svc.list({ page: 1, limit: 100 });

      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ACTIVE', limit: 50, offset: 0 }),
      );
    });

    it('resolves subcategory slug to descendant category ids', async () => {
      const list = jest.fn().mockResolvedValue({ products: [], total: 0 });
      const findBySlug = jest.fn().mockResolvedValue({
        id: 'subcat-1',
        name: 'Robes',
        slug: 'robes',
        parent_id: 'cat-1',
        column_group: null,
        image_url: null,
        position: 0,
        created_at: new Date(),
        updated_at: new Date(),
      });
      const findDescendantIds = jest.fn().mockResolvedValue(['subcat-1', 'subcat-child-1']);

      const svc = buildService({ list }, {}, { findBySlug, findDescendantIds });
      await svc.list({ subcategory: 'robes' });

      expect(findDescendantIds).toHaveBeenCalledWith('subcat-1');
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ category_ids: ['subcat-1', 'subcat-child-1'] }),
      );
    });
  });

  describe('findById', () => {
    it('throws PRODUCT_NOT_FOUND when product is not ACTIVE', async () => {
      const detail: ProductDetailRow = {
        product: makeProduct({ status: 'DRAFT' }),
        images: [],
        vendor: { shop_name: 'Shop', shop_logo: null, rating: 4.5, total_sales: 12 },
        reviews: [],
        vendor_region: 'Maritime',
        category_path: { universe: 'Femme', category: 'Robes', subcategory: null },
      };
      const svc = buildService({ findDetailById: jest.fn().mockResolvedValue(detail) });

      await expect(svc.findById('prod-1')).rejects.toMatchObject({
        statusCode: 404,
        code: 'PRODUCT_NOT_FOUND',
      });
    });

    it('returns product detail without incrementing views', async () => {
      const detail: ProductDetailRow = {
        product: makeProduct(),
        images: [makeImage()],
        vendor: { shop_name: 'Shop Test', shop_logo: null, rating: 4.8, total_sales: 5 },
        reviews: [],
        vendor_region: 'Maritime',
        category_path: { universe: 'Femme', category: 'Robes', subcategory: null },
      };
      const incrementViews = jest.fn().mockResolvedValue(undefined);
      const svc = buildService({
        findDetailById: jest.fn().mockResolvedValue(detail),
        incrementViews,
      });

      const result = await svc.findById('prod-1');

      expect(result.title).toBe('Robe wax');
      expect(result.images).toHaveLength(1);
      expect(result.vendor.shop_name).toBe('Shop Test');
      expect(incrementViews).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('creates product with PENDING_REVIEW status and uploads images', async () => {
      const create = jest.fn().mockImplementation((data) =>
        Promise.resolve(makeProduct({ id: data.id, status: data.status })),
      );
      const createMany = jest.fn().mockResolvedValue([]);
      const svc = buildService({ create }, { createMany });

      const product = await svc.create('vendor-1', {
        title: 'Nouveau produit',
        price: 8000,
        images: ['https://example.com/photo.jpg'],
      });

      expect(product.status).toBe('PENDING_REVIEW');
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ vendor_id: 'vendor-1', status: 'PENDING_REVIEW' }),
      );
      expect(createMany).toHaveBeenCalledWith([
        expect.objectContaining({
          product_id: product.id,
          url: 'https://example.com/photo.jpg',
          position: 0,
          is_primary: true,
        }),
      ]);
    });
  });

  describe('update', () => {
    it('throws FORBIDDEN when vendor does not own the product', async () => {
      const svc = buildService({
        findById: jest.fn().mockResolvedValue(makeProduct({ vendor_id: 'other-vendor' })),
      });

      await expect(svc.update('prod-1', 'vendor-1', { title: 'Hack' })).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });
  });

  describe('delete', () => {
    it('soft-deletes by setting status to ARCHIVED', async () => {
      const updateStatus = jest.fn().mockResolvedValue(makeProduct({ status: 'ARCHIVED' }));
      const svc = buildService(
        {
          findById: jest.fn().mockResolvedValue(makeProduct()),
          updateStatus,
        },
      );

      await svc.delete('prod-1', 'vendor-1');

      expect(updateStatus).toHaveBeenCalledWith('prod-1', 'ARCHIVED');
    });
  });

  describe('toggleStatus', () => {
    it('toggles ACTIVE to DRAFT', async () => {
      const updateStatus = jest.fn().mockResolvedValue(makeProduct({ status: 'DRAFT' }));
      const svc = buildService({
        findById: jest.fn().mockResolvedValue(makeProduct({ status: 'ACTIVE' })),
        updateStatus,
      });

      const result = await svc.toggleStatus('prod-1', 'vendor-1');
      expect(result.status).toBe('DRAFT');
      expect(updateStatus).toHaveBeenCalledWith('prod-1', 'DRAFT');
    });

    it('toggles DRAFT to ACTIVE', async () => {
      const updateStatus = jest.fn().mockResolvedValue(makeProduct({ status: 'ACTIVE' }));
      const svc = buildService({
        findById: jest.fn().mockResolvedValue(makeProduct({ status: 'DRAFT' })),
        updateStatus,
      });

      const result = await svc.toggleStatus('prod-1', 'vendor-1');
      expect(result.status).toBe('ACTIVE');
    });

    it('rejects toggle for PENDING_REVIEW products', async () => {
      const svc = buildService({
        findById: jest.fn().mockResolvedValue(makeProduct({ status: 'PENDING_REVIEW' })),
      });

      await expect(svc.toggleStatus('prod-1', 'vendor-1')).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });
  });

  describe('incrementViews', () => {
    it('delegates to repository', async () => {
      const incrementViews = jest.fn().mockResolvedValue(undefined);
      const svc = buildService({ incrementViews });

      await svc.incrementViews('prod-1');
      expect(incrementViews).toHaveBeenCalledWith('prod-1');
    });
  });
});
