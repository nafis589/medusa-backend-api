import 'dotenv/config';
import { initializeDatabase, closePool } from '@shared/utils/db';
import { DEMO_VENDOR_CREDENTIALS, seedDemoVendor } from './demo-vendor.seed';

/**
 * Crée / met à jour le vendeur de démo sans effacer la base.
 * Usage: npm run seed:vendor
 */
async function main(): Promise<void> {
  console.log('🌱 Seeding dashboard vendor (ACTIVE)…');
  await initializeDatabase();
  await seedDemoVendor();
  console.log('\n📋 Connexion dashboard vendeur :');
  console.log(`   URL      : http://localhost:3000/login (ou port du dashboard)`);
  console.log(`   Email    : ${DEMO_VENDOR_CREDENTIALS.email}`);
  console.log(`   Password : ${DEMO_VENDOR_CREDENTIALS.password}`);
  await closePool();
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('❌ seed:vendor failed:', err);
  process.exit(1);
});
