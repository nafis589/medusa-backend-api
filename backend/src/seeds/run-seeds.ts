import 'dotenv/config';
import { initializeDatabase, clearDatabase, closePool } from '@shared/utils/db';
import { getRedis } from '@shared/utils/redis';
import { seedCategories } from './categories.seed';
import { seedDemoVendor } from './demo-vendor.seed';
import { seedDemoProducts } from './demo-products.seed';

/**
 * Seeds entry point — runs all seed files in order.
 * Usage: npm run seed
 */
async function main(): Promise<void> {
  console.log('🌱 Running seeds...');

  await initializeDatabase();
  await clearDatabase();

  // Phase 1 — Categories
  await seedCategories();

  // Vendeur de démo + livraison (checkout storefront)
  await seedDemoVendor();

  // Phase 4 — Demo products (storefront homepage)
  await seedDemoProducts();

  try {
    await getRedis().del('trending:products', 'categories:tree');
  } catch {
    // Redis optional during seed
  }

  // Phase 2 — Admin user
  const { seedAdminUser } = await import('./admin-user.seed');
  await seedAdminUser();

  await closePool();
  console.log('✅ All seeds completed');
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
