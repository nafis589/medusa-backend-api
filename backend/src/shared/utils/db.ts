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

  // Create users table
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id CHAR(36) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      role ENUM('BUYER', 'VENDOR', 'ADMIN') DEFAULT 'BUYER' NOT NULL,
      avatar_url VARCHAR(500) NULL,
      phone VARCHAR(20) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Create vendors table
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS vendors (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36) UNIQUE NOT NULL,
      shop_name VARCHAR(255) NOT NULL,
      shop_description TEXT NULL,
      shop_logo VARCHAR(500) NULL,
      shop_banner VARCHAR(500) NULL,
      status ENUM('PENDING', 'ACTIVE', 'SUSPENDED') DEFAULT 'PENDING' NOT NULL,
      total_sales INT DEFAULT 0 NOT NULL,
      rating DECIMAL(3, 2) DEFAULT 0.00 NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Migrate legacy products stub (Phase 1) to full schema (Phase 4)
  const [productCols] = await dbPool.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'vendor_id'`,
  );
  if (Number(productCols[0]?.cnt) === 0) {
    await dbPool.query('SET FOREIGN_KEY_CHECKS = 0');
    await dbPool.query('DROP TABLE IF EXISTS product_images');
    await dbPool.query('DROP TABLE IF EXISTS products');
    await dbPool.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  // Create products table (Phase 4)
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id CHAR(36) PRIMARY KEY,
      vendor_id CHAR(36) NOT NULL,
      title VARCHAR(300) NOT NULL,
      description TEXT NULL,
      price INT NOT NULL,
      category_id CHAR(36) NULL,
      brand VARCHAR(100) NULL,
      \`condition\` ENUM('NEW', 'VERY_GOOD', 'GOOD', 'FAIR') NULL,
      material VARCHAR(100) NULL,
      color VARCHAR(50) NULL,
      size VARCHAR(20) NULL,
      status ENUM('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'SOLD', 'ARCHIVED', 'REJECTED') DEFAULT 'DRAFT' NOT NULL,
      stock INT DEFAULT 1 NOT NULL,
      views_count INT DEFAULT 0 NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      INDEX idx_product_category (category_id),
      INDEX idx_product_vendor (vendor_id),
      INDEX idx_product_status (status),
      INDEX idx_product_created (created_at DESC),
      INDEX idx_product_price (price),
      FULLTEXT INDEX idx_product_search (title, description)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Migrate products.stock column (Phase 5 — cart)
  const [stockCols] = await dbPool.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'stock'`,
  );
  if (Number(stockCols[0]?.cnt) === 0) {
    try {
      await dbPool.query(
        'ALTER TABLE products ADD COLUMN stock INT DEFAULT 1 NOT NULL AFTER status',
      );
    } catch (err: unknown) {
      const mysqlErr = err as { code?: string };
      if (mysqlErr.code !== 'ER_DUP_FIELDNAME') throw err;
    }
  }

  // Create product_images table (Phase 4)
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS product_images (
      id CHAR(36) PRIMARY KEY,
      product_id CHAR(36) NOT NULL,
      url VARCHAR(500) NOT NULL,
      position INT DEFAULT 0 NOT NULL,
      is_primary BOOLEAN DEFAULT FALSE NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      INDEX idx_product_image_product (product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Create carts table (Phase 5)
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS carts (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36) NULL,
      session_id VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_cart_user (user_id),
      INDEX idx_cart_session (session_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Create cart_items table (Phase 5)
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id CHAR(36) PRIMARY KEY,
      cart_id CHAR(36) NOT NULL,
      product_id CHAR(36) NOT NULL,
      quantity INT DEFAULT 1 NOT NULL,
      price_snapshot INT NOT NULL,
      FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      UNIQUE KEY uk_cart_product (cart_id, product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Create vendor_locations table (Phase 3 — shipping)
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS vendor_locations (
      id CHAR(36) PRIMARY KEY,
      vendor_id CHAR(36) UNIQUE NOT NULL,
      latitude DECIMAL(10, 7) NOT NULL,
      longitude DECIMAL(10, 7) NOT NULL,
      region_id VARCHAR(20) NOT NULL,
      address VARCHAR(500) NULL,
      city VARCHAR(100) NULL,
      is_valid BOOLEAN DEFAULT FALSE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Create vendor_shipping_regions table (Phase 3 — shipping)
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS vendor_shipping_regions (
      id CHAR(36) PRIMARY KEY,
      vendor_id CHAR(36) NOT NULL,
      region_id VARCHAR(20) NOT NULL,
      is_home_region BOOLEAN DEFAULT FALSE NOT NULL,
      price_per_km INT NULL,
      min_fee INT DEFAULT 500 NOT NULL,
      fixed_price INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
      UNIQUE KEY uk_vendor_shipping_region (vendor_id, region_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Create orders table (Phase 6)
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id CHAR(36) PRIMARY KEY,
      buyer_id CHAR(36) NOT NULL,
      vendor_id CHAR(36) NOT NULL,
      status ENUM(
        'PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPED',
        'DELIVERED', 'CANCELLED', 'RETURNED'
      ) DEFAULT 'PENDING' NOT NULL,
      total_amount INT NOT NULL,
      shipping_fee INT NOT NULL,
      payment_method ENUM('CASH_ON_DELIVERY', 'BANK_TRANSFER') DEFAULT 'CASH_ON_DELIVERY' NOT NULL,
      shipping_address JSON NOT NULL,
      shipping_region_id VARCHAR(20) NOT NULL,
      shipping_method VARCHAR(10) NOT NULL,
      shipping_distance_km DECIMAL(10, 2) NULL,
      tracking_number VARCHAR(100) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE RESTRICT,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT,
      INDEX idx_order_buyer (buyer_id),
      INDEX idx_order_vendor (vendor_id),
      INDEX idx_order_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Create order_items table (Phase 6)
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id CHAR(36) PRIMARY KEY,
      order_id CHAR(36) NOT NULL,
      product_id CHAR(36) NULL,
      quantity INT NOT NULL,
      unit_price INT NOT NULL,
      product_snapshot JSON NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
      INDEX idx_order_item_order (order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Create order_status_history table (Phase 6)
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS order_status_history (
      id CHAR(36) PRIMARY KEY,
      order_id CHAR(36) NOT NULL,
      status ENUM(
        'PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPED',
        'DELIVERED', 'CANCELLED', 'RETURNED'
      ) NOT NULL,
      note TEXT NULL,
      created_by CHAR(36) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
      INDEX idx_order_status_history_order (order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Create notifications table (Phase 9 — used by order subscribers)
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(200) NOT NULL,
      body TEXT NOT NULL,
      is_read BOOLEAN DEFAULT FALSE NOT NULL,
      metadata JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_notification_user (user_id, is_read)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Create vendor_follows table (storefront — vendor profile follow feature)
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS vendor_follows (
      id CHAR(36) PRIMARY KEY,
      follower_id CHAR(36) NOT NULL,
      vendor_id CHAR(36) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
      UNIQUE KEY uk_follower_vendor (follower_id, vendor_id),
      INDEX idx_vendor_follows_vendor (vendor_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Create conversations table (storefront — buyer/vendor chat)
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id CHAR(36) PRIMARY KEY,
      buyer_id CHAR(36) NOT NULL,
      vendor_id CHAR(36) NOT NULL,
      product_id CHAR(36) NULL,
      last_message_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
      INDEX idx_conversation_buyer (buyer_id),
      INDEX idx_conversation_vendor (vendor_id),
      INDEX idx_conversation_pair (buyer_id, vendor_id, product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Create messages table (storefront — chat messages)
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id CHAR(36) PRIMARY KEY,
      conversation_id CHAR(36) NOT NULL,
      sender_id CHAR(36) NOT NULL,
      content TEXT NOT NULL,
      type ENUM('TEXT', 'OFFER', 'SYSTEM') DEFAULT 'TEXT' NOT NULL,
      is_read BOOLEAN DEFAULT FALSE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_message_conversation (conversation_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Create offers table (storefront — price negotiation)
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS offers (
      id CHAR(36) PRIMARY KEY,
      product_id CHAR(36) NOT NULL,
      buyer_id CHAR(36) NOT NULL,
      vendor_id CHAR(36) NOT NULL,
      amount INT NOT NULL,
      status ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'COUNTER', 'EXPIRED') DEFAULT 'PENDING' NOT NULL,
      counter_amount INT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
      INDEX idx_offer_buyer (buyer_id),
      INDEX idx_offer_vendor (vendor_id),
      INDEX idx_offer_product (product_id),
      INDEX idx_offer_status (status)
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
  await dbPool.query('TRUNCATE TABLE messages;');
  await dbPool.query('TRUNCATE TABLE conversations;');
  await dbPool.query('TRUNCATE TABLE offers;');
  await dbPool.query('TRUNCATE TABLE vendor_follows;');
  await dbPool.query('TRUNCATE TABLE notifications;');
  await dbPool.query('TRUNCATE TABLE order_status_history;');
  await dbPool.query('TRUNCATE TABLE order_items;');
  await dbPool.query('TRUNCATE TABLE orders;');
  await dbPool.query('TRUNCATE TABLE vendor_shipping_regions;');
  await dbPool.query('TRUNCATE TABLE vendor_locations;');
  await dbPool.query('TRUNCATE TABLE cart_items;');
  await dbPool.query('TRUNCATE TABLE carts;');
  await dbPool.query('TRUNCATE TABLE product_images;');
  await dbPool.query('TRUNCATE TABLE products;');
  await dbPool.query('TRUNCATE TABLE categories;');
  await dbPool.query('TRUNCATE TABLE vendors;');
  await dbPool.query('TRUNCATE TABLE users;');
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
