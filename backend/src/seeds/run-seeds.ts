import 'dotenv/config';
import { initializeDatabase, closePool } from '@shared/utils/db';
import { seedCategories } from './categories.seed';

/**
 * Seeds entry point — runs all seed files in order.
 * Usage: npm run seed
 */
async function main(): Promise<void> {
  console.log('🌱 Running seeds...');

  await initializeDatabase();

  // Phase 1 — Categories
  await seedCategories();

  // Phase 2 — Admin user
  // const { seedAdminUser } = await import('./admin-user.seed');
  // await seedAdminUser();

  await closePool();
  console.log('✅ All seeds completed');
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
