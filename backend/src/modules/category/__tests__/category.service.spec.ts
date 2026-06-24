/* eslint-disable @typescript-eslint/unbound-method */
import { CategoryService } from '../category.service';
import type { ICategoryRepository } from '../category.repository.interface';
import type { Category, CreateCategoryData, UpdateCategoryData } from '../category.entity';
import { AppError } from '@shared/errors/app-error';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    name: 'Femme',
    slug: 'femme',
    parent_id: null,
    column_group: null,
    image_url: null,
    position: 0,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides,
  };
}

/** Build a fully-mocked ICategoryRepository */
function buildRepo(overrides: Partial<ICategoryRepository> = {}): ICategoryRepository {
  return {
    findAll: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
    findBySlug: jest.fn().mockResolvedValue(null),
    isSlugTaken: jest.fn().mockResolvedValue(false),
    countProducts: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockImplementation((data: CreateCategoryData & { id: string; slug: string }) =>
      Promise.resolve({
        id: data.id,
        name: data.name,
        slug: data.slug,
        parent_id: data.parent_id ?? null,
        column_group: data.column_group ?? null,
        image_url: data.image_url ?? null,
        position: data.position ?? 0,
        created_at: new Date(),
        updated_at: new Date(),
      }),
    ),
    update: jest.fn().mockImplementation((id: string, data: UpdateCategoryData) =>
      Promise.resolve({
        ...makeCategory({ id }),
        ...data,
      }),
    ),
    delete: jest.fn().mockResolvedValue(undefined),
    findDescendantIds: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

// ── Test suites ─────────────────────────────────────────────────────────────

describe('CategoryService', () => {
  // ── getTree ─────────────────────────────────────────────────────────────

  describe('getTree', () => {
    it('returns an empty array when there are no categories', async () => {
      const repo = buildRepo({ findAll: jest.fn().mockResolvedValue([]) });
      const svc = new CategoryService(repo);
      expect(await svc.getTree()).toEqual([]);
    });

    it('returns root nodes with nested children ordered by position', async () => {
      const root = makeCategory({ id: 'root', parent_id: null, position: 0, slug: 'femme', name: 'Femme' });
      const child1 = makeCategory({ id: 'c1', parent_id: 'root', position: 2, slug: 'robes', name: 'Robes' });
      const child2 = makeCategory({ id: 'c2', parent_id: 'root', position: 1, slug: 'tops', name: 'Tops' });
      const grandchild = makeCategory({ id: 'gc1', parent_id: 'c1', position: 0, slug: 'robe-midi', name: 'Robe midi' });

      const repo = buildRepo({ findAll: jest.fn().mockResolvedValue([root, child1, child2, grandchild]) });
      const svc = new CategoryService(repo);

      const tree = await svc.getTree();

      // One root node
      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe('root');

      // Children sorted by position ASC → child2 (pos 1) before child1 (pos 2)
      expect(tree[0].children).toHaveLength(2);
      expect(tree[0].children[0].id).toBe('c2');
      expect(tree[0].children[1].id).toBe('c1');

      // Grandchild nested under child1
      expect(tree[0].children[1].children).toHaveLength(1);
      expect(tree[0].children[1].children[0].id).toBe('gc1');
    });

    it('handles multiple root categories sorted by position', async () => {
      const a = makeCategory({ id: 'a', parent_id: null, position: 3, slug: 'homme' });
      const b = makeCategory({ id: 'b', parent_id: null, position: 1, slug: 'femme' });
      const c = makeCategory({ id: 'c', parent_id: null, position: 2, slug: 'enfant' });

      const repo = buildRepo({ findAll: jest.fn().mockResolvedValue([a, b, c]) });
      const svc = new CategoryService(repo);

      const tree = await svc.getTree();
      expect(tree.map((n) => n.id)).toEqual(['b', 'c', 'a']);
    });
  });

  // ── findBySlug ───────────────────────────────────────────────────────────

  describe('findBySlug', () => {
    it('throws 404 when slug is not found', async () => {
      const svc = new CategoryService(buildRepo());
      await expect(svc.findBySlug('unknown')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });

    it('returns the category with its children when slug exists', async () => {
      const parent = makeCategory({ id: 'p', slug: 'femme' });
      const child = makeCategory({ id: 'ch', slug: 'robes', parent_id: 'p', position: 0 });
      const repo = buildRepo({
        findBySlug: jest.fn().mockResolvedValue(parent),
        findAll: jest.fn().mockResolvedValue([parent, child]),
      });
      const svc = new CategoryService(repo);

      const result = await svc.findBySlug('femme');
      expect(result.id).toBe('p');
      expect(result.children).toHaveLength(1);
      expect(result.children[0].id).toBe('ch');
    });
  });

  // ── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('auto-generates slug from name when slug is not provided', async () => {
      const repo = buildRepo();
      const svc = new CategoryService(repo);

      await svc.create({ name: 'Bijoux & Montres' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'bijoux-montres' }),
      );
    });

    it('uses provided slug when given', async () => {
      const repo = buildRepo();
      const svc = new CategoryService(repo);

      await svc.create({ name: 'Femme', slug: 'ma-femme' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'ma-femme' }),
      );
    });

    it('throws 409 CONFLICT when slug is already taken', async () => {
      const repo = buildRepo({ isSlugTaken: jest.fn().mockResolvedValue(true) });
      const svc = new CategoryService(repo);

      await expect(svc.create({ name: 'Femme' })).rejects.toMatchObject({
        statusCode: 409,
        code: 'CONFLICT',
      });
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('assigns default position 0 and null nullable fields when omitted', async () => {
      const repo = buildRepo();
      const svc = new CategoryService(repo);

      await svc.create({ name: 'Sport' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          position: 0,
          parent_id: null,
          column_group: null,
          image_url: null,
        }),
      );
    });
  });

  // ── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('throws 404 when category does not exist', async () => {
      const svc = new CategoryService(buildRepo({ findById: jest.fn().mockResolvedValue(null) }));
      await expect(svc.update('ghost-id', { name: 'X' })).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });

    it('updates and returns the modified category', async () => {
      const existing = makeCategory();
      const repo = buildRepo({
        findById: jest.fn().mockResolvedValue(existing),
        update: jest.fn().mockResolvedValue({ ...existing, name: 'Femme Updated' }),
      });
      const svc = new CategoryService(repo);

      const result = await svc.update('cat-1', { name: 'Femme Updated' });
      expect(result.name).toBe('Femme Updated');
    });

    it('throws 409 CONFLICT when new slug is already taken by a different category', async () => {
      const existing = makeCategory({ slug: 'femme' });
      const repo = buildRepo({
        findById: jest.fn().mockResolvedValue(existing),
        isSlugTaken: jest.fn().mockResolvedValue(true),
      });
      const svc = new CategoryService(repo);

      await expect(svc.update('cat-1', { slug: 'homme' })).rejects.toMatchObject({
        statusCode: 409,
        code: 'CONFLICT',
      });
    });
  });

  // ── delete ───────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('throws 404 when category does not exist', async () => {
      const svc = new CategoryService(buildRepo({ findById: jest.fn().mockResolvedValue(null) }));
      await expect(svc.delete('ghost-id')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });

    it('throws 409 CATEGORY_HAS_PRODUCTS when products are attached', async () => {
      const existing = makeCategory();
      const repo = buildRepo({
        findById: jest.fn().mockResolvedValue(existing),
        countProducts: jest.fn().mockResolvedValue(3),
      });
      const svc = new CategoryService(repo);

      await expect(svc.delete('cat-1')).rejects.toMatchObject({
        statusCode: 409,
        code: 'CATEGORY_HAS_PRODUCTS',
      });
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('deletes successfully when no products are attached', async () => {
      const existing = makeCategory();
      const repo = buildRepo({
        findById: jest.fn().mockResolvedValue(existing),
        countProducts: jest.fn().mockResolvedValue(0),
        delete: jest.fn().mockResolvedValue(undefined),
      });
      const svc = new CategoryService(repo);

      await expect(svc.delete('cat-1')).resolves.toBeUndefined();
      expect(repo.delete).toHaveBeenCalledWith('cat-1');
    });
  });
});

// Minimal check that AppError is importable (guards against circular deps)
describe('AppError integration', () => {
  it('is correctly used in CategoryService errors', () => {
    const err = new AppError(409, 'CATEGORY_HAS_PRODUCTS', 'blocked');
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(409);
  });
});
