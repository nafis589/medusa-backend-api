import mysql from 'mysql2/promise';
import { logger } from './logger';

let pool: mysql.Pool | null = null;

/**
 * Returns the MySQL connection pool singleton.
 */
export function getPool(): mysql.Pool {
  if (!pool) {
    const host = process.env.DB_HOST ?? 'localhost';
    const port = Number(process.env.DB_PORT ?? 3306);
    const user = process.env.DB_USER ?? 'root';
    const password = process.env.DB_PASSWORD ?? '';
    const database = process.env.DB_NAME ?? 'marketplace_db';

    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      charset: 'utf8mb4',
    });
  }
  return pool;
}

/**
 * Ensures the target database and core tables exist.
 * This runs on app startup and before seeding or running integration tests.
 */
export async function initializeDatabase(): Promise<void> {
  const host = process.env.DB_HOST ?? 'localhost';
  const port = Number(process.env.DB_PORT ?? 3306);
  const user = process.env.DB_USER ?? 'root';
  const password = process.env.DB_PASSWORD ?? '';
  const database = process.env.DB_NAME ?? 'marketplace_db';

  logger.info(`Checking MySQL database status on ${host}:${String(port)}...`);

  // 1. Create database if it does not exist
  const initConnection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    charset: 'utf8mb4',
  });

  try {
    await initConnection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\`;`);
    logger.info(`Database '${database}' is verified / created.`);
  } finally {
    await initConnection.end();
  }

  // 2. Initialize tables
  const dbPool = getPool();

  logger.info('Initializing database schema tables...');

  // Enable foreign keys
  await dbPool.query('SET FOREIGN_KEY_CHECKS = 1;');

  // Create categories table
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id CHAR(36) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(100) UNIQUE NOT NULL,
      parent_id CHAR(36) NULL,
      column_group VARCHAR(100) NULL,
      image_url VARCHAR(500) NULL,
      position INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Create products table stub (so that countProducts category constraints work in Phase 1)
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id CHAR(36) PRIMARY KEY,
      category_id CHAR(36) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  logger.info('Database schema tables verified successfully.');
}

/**
 * Utility to clear data in the tables — used for seeding and running test suites.
 */
export async function clearDatabase(): Promise<void> {
  const dbPool = getPool();
  await dbPool.query('SET FOREIGN_KEY_CHECKS = 0;');
  await dbPool.query('TRUNCATE TABLE products;');
  await dbPool.query('TRUNCATE TABLE categories;');
  await dbPool.query('SET FOREIGN_KEY_CHECKS = 1;');
  logger.info('Database tables cleared.');
}

/**
 * Closes the database pool connection.
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database pool closed.');
  }
}
