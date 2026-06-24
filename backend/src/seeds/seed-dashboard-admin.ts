import 'dotenv/config';
import { initializeDatabase, closePool } from '@shared/utils/db';
import { seedAdminUser, DEMO_ADMIN_CREDENTIALS } from './admin-user.seed';

/**
 * Usage: npm run seed:admin
 * Non-destructive: does NOT clear database.
 */
async function main(): Promise<void> {
  console.log('🌱 Seeding demo admin...');
  await initializeDatabase();
  await seedAdminUser();
  await closePool();
  console.log('✅ Demo admin seeded');
  console.log(`   Email    : ${DEMO_ADMIN_CREDENTIALS.email}`);
  console.log(`   Password : ${DEMO_ADMIN_CREDENTIALS.password}`);
}

main().catch((err: unknown) => {
  console.error('❌ seed:admin failed:', err);
  process.exit(1);
});

