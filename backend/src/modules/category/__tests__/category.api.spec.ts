/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
import dotenv from 'dotenv';
dotenv.config({ override: true });
process.env.NODE_ENV = 'test';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '@/index';
import { getRedis } from '@shared/utils/redis';
import { closePool, clearDatabase, getPool, initializeDatabase } from '@shared/utils/db';
import { signToken } from '@shared/utils/jwt.util';

describe('Category API Integration Tests', () => {
  const adminToken = signToken({ id: 'admin-1', email: 'admin@marketplace.com', role: 'ADMIN' });
  const userToken = signToken({ id: 'user-1', email: 'user@marketplace.com', role: 'BUYER' });

  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    const redis = getRedis();
    await redis.del('categories:tree');
  });

  afterAll(async () => {
    // Clear database and close active connections to ensure clean exit
    await clearDatabase();
    const redis = getRedis();
    await redis.quit();
    await closePool();
  });

  describe('GET /api/store/categories', () => {
    it('should return an empty array if no categories exist', async () => {
      const res = await request(app).get('/api/store/categories');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: [] });
    });

    it('should return the full nested category tree structure', async () => {
      // 1. Manually insert categories using the connection pool
      const db = getPool();
      const rootId = randomUUID();
      const childId = randomUUID();

      await db.query(
        'INSERT INTO categories (id, name, slug, parent_id, position) VALUES (?, ?, ?, ?, ?)',
        [rootId, 'Femme', 'femme', null, 1]
      );
      await db.query(
        'INSERT INTO categories (id, name, slug, parent_id, position) VALUES (?, ?, ?, ?, ?)',
        [childId, 'Robes', 'robes', rootId, 0]
      );

      // 2. Fetch the category tree
      const res = await request(app).get('/api/store/categories');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(rootId);
      expect(res.body.data[0].children).toHaveLength(1);
      expect(res.body.data[0].children[0].id).toBe(childId);
    });

    it('should read from and write to Redis caching layer', async () => {
      const redis = getRedis();
      const cacheKey = 'categories:tree';

      // 1. Manually write a mock tree payload to Redis
      const mockCachedTree = [{ id: 'mock-id', name: 'Cached Category', slug: 'cached-cat', children: [] }];
      await redis.set(cacheKey, JSON.stringify(mockCachedTree), 'EX', 3600);

      // 2. Query storefront categories, which should hit the Redis cache and bypass the DB
      const res = await request(app).get('/api/store/categories');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(mockCachedTree);
    });
  });

  describe('GET /api/store/categories/:slug', () => {
    it('should return category details and children by slug', async () => {
      const db = getPool();
      const parentId = randomUUID();
      const childId = randomUUID();

      await db.query(
        'INSERT INTO categories (id, name, slug, parent_id, position) VALUES (?, ?, ?, ?, ?)',
        [parentId, 'Femme', 'femme', null, 1]
      );
      await db.query(
        'INSERT INTO categories (id, name, slug, parent_id, position) VALUES (?, ?, ?, ?, ?)',
        [childId, 'Robes', 'robes', parentId, 0]
      );

      const res = await request(app).get('/api/store/categories/femme');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(parentId);
      expect(res.body.data.children).toHaveLength(1);
      expect(res.body.data.children[0].id).toBe(childId);
    });

    it('should return 404 NOT_FOUND if the slug does not exist', async () => {
      const res = await request(app).get('/api/store/categories/non-existent-slug');

      expect(res.status).toBe(404);
      expect(res.body.error).toEqual(
        expect.objectContaining({
          code: 'NOT_FOUND',
        })
      );
    });
  });

  describe('POST /api/admin/categories', () => {
    it('should fail with 401 UNAUTHORIZED if authorization header is missing', async () => {
      const res = await request(app)
        .post('/api/admin/categories')
        .send({ name: 'Homme' });

      expect(res.status).toBe(401);
    });

    it('should fail with 403 FORBIDDEN if user is not an admin', async () => {
      const res = await request(app)
        .post('/api/admin/categories')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Homme' });

      expect(res.status).toBe(403);
    });

    it('should fail with 400 VALIDATION_ERROR if parameters are missing or invalid', async () => {
      const res = await request(app)
        .post('/api/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '' }); // Empty name validation error

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should create a new category, save it to the DB, and clear the Redis cache', async () => {
      // Pre-seed Redis cache
      const redis = getRedis();
      await redis.set('categories:tree', 'mock-data');

      const categoryData = {
        name: 'Électronique',
        slug: 'electronique',
        column_group: 'Tech',
        position: 5,
      };

      const res = await request(app)
        .post('/api/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(categoryData);

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe(categoryData.name);
      expect(res.body.data.slug).toBe(categoryData.slug);
      expect(res.body.data.column_group).toBe(categoryData.column_group);
      expect(res.body.data.position).toBe(categoryData.position);

      // Verify that category exists in the DB
      const db = getPool();
      const [rows] = await db.query('SELECT * FROM categories WHERE id = ?', [res.body.data.id]);
      expect((rows as unknown[]).length).toBe(1);

      // Verify cache invalidation
      const cached = await redis.get('categories:tree');
      expect(cached).toBeNull();
    });

    it('should return 409 CONFLICT if the slug is already in use', async () => {
      const db = getPool();
      const categoryId = randomUUID();
      await db.query(
        'INSERT INTO categories (id, name, slug, parent_id, position) VALUES (?, ?, ?, ?, ?)',
        [categoryId, 'Femme', 'femme', null, 1]
      );

      const res = await request(app)
        .post('/api/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Femme', slug: 'femme' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('PATCH /api/admin/categories/:id', () => {
    it('should return 400 VALIDATION_ERROR if the category ID is not a valid UUID', async () => {
      const res = await request(app)
        .patch('/api/admin/categories/invalid-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New Name' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 NOT_FOUND if category does not exist', async () => {
      const testId = randomUUID();
      const res = await request(app)
        .patch(`/api/admin/categories/${testId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New Name' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should update the category and invalidate the categories tree cache', async () => {
      const db = getPool();
      const categoryId = randomUUID();
      await db.query(
        'INSERT INTO categories (id, name, slug, parent_id, position) VALUES (?, ?, ?, ?, ?)',
        [categoryId, 'Femme', 'femme', null, 1]
      );

      const redis = getRedis();
      await redis.set('categories:tree', 'mock-data');

      const res = await request(app)
        .patch(`/api/admin/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Femme Active', slug: 'femme-active', position: 2 });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Femme Active');
      expect(res.body.data.slug).toBe('femme-active');
      expect(res.body.data.position).toBe(2);

      // Verify changes in the DB
      const [rows] = await db.query('SELECT * FROM categories WHERE id = ?', [categoryId]);
      const result = (rows as any[])[0];
      expect(result.name).toBe('Femme Active');
      expect(result.position).toBe(2);

      // Verify cache invalidation
      const cached = await redis.get('categories:tree');
      expect(cached).toBeNull();
    });

    it('should return 409 CONFLICT if updating to a slug that is already in use by another category', async () => {
      const db = getPool();
      const id1 = randomUUID();
      const id2 = randomUUID();

      await db.query(
        'INSERT INTO categories (id, name, slug, parent_id, position) VALUES (?, ?, ?, ?, ?)',
        [id1, 'Femme', 'femme', null, 1]
      );
      await db.query(
        'INSERT INTO categories (id, name, slug, parent_id, position) VALUES (?, ?, ?, ?, ?)',
        [id2, 'Homme', 'homme', null, 2]
      );

      const res = await request(app)
        .patch(`/api/admin/categories/${id2}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ slug: 'femme' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('DELETE /api/admin/categories/:id', () => {
    it('should return 404 NOT_FOUND if category does not exist', async () => {
      const testId = randomUUID();
      const res = await request(app)
        .delete(`/api/admin/categories/${testId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 409 CATEGORY_HAS_PRODUCTS if products are still attached to the category', async () => {
      const db = getPool();
      const categoryId = randomUUID();
      const productId = randomUUID();

      await db.query(
        'INSERT INTO categories (id, name, slug, parent_id, position) VALUES (?, ?, ?, ?, ?)',
        [categoryId, 'Femme', 'femme', null, 1]
      );

      await db.query('INSERT INTO products (id, category_id) VALUES (?, ?)', [productId, categoryId]);

      const res = await request(app)
        .delete(`/api/admin/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CATEGORY_HAS_PRODUCTS');
    });

    it('should delete the category and invalidate the categories tree cache if no products are attached', async () => {
      const db = getPool();
      const categoryId = randomUUID();

      await db.query(
        'INSERT INTO categories (id, name, slug, parent_id, position) VALUES (?, ?, ?, ?, ?)',
        [categoryId, 'Femme', 'femme', null, 1]
      );

      const redis = getRedis();
      await redis.set('categories:tree', 'mock-data');

      const res = await request(app)
        .delete(`/api/admin/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('Category deleted successfully');

      // Verify deletion from DB
      const [rows] = await db.query('SELECT * FROM categories WHERE id = ?', [categoryId]);
      expect((rows as unknown[]).length).toBe(0);

      // Verify cache invalidation
      const cached = await redis.get('categories:tree');
      expect(cached).toBeNull();
    });
  });
});
