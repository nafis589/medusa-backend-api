import { getPool } from '@shared/utils/db';
import { hashPassword } from '@shared/utils/hash';
import { ShippingService } from '../modules/shipping/shipping.service';
import { VendorLocationRepository } from '../modules/shipping/vendor-location.repository';
import { VendorShippingRegionRepository } from '../modules/shipping/vendor-shipping-region.repository';

/** Doit correspondre à storefront/lib/demo-vendor.ts */
export const DEMO_VENDOR_ID = 'b0000000-0000-4000-8000-000000000001';
const DEMO_USER_ID = 'b0000000-0000-4000-8000-000000000002';

/** Identifiants pour se connecter au dashboard vendeur */
export const DEMO_VENDOR_CREDENTIALS = {
  email: 'vendeur@demo.marketplace',
  password: 'Vendeur123!',
} as const;

/**
 * Crée ou met à jour un vendeur de démo ACTIVE avec configuration de livraison (Lomé).
 */
export async function seedDemoVendor(): Promise<void> {
  const db = getPool();
  const hashed = await hashPassword(DEMO_VENDOR_CREDENTIALS.password);

  await db.query(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, role)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       email = VALUES(email),
       password_hash = VALUES(password_hash),
       first_name = VALUES(first_name),
       last_name = VALUES(last_name),
       role = VALUES(role)`,
    [
      DEMO_USER_ID,
      DEMO_VENDOR_CREDENTIALS.email,
      hashed,
      'Demo',
      'Vendeur',
      'VENDOR',
    ],
  );

  await db.query(
    `INSERT INTO vendors (id, user_id, shop_name, shop_description, status)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       shop_name = VALUES(shop_name),
       shop_description = VALUES(shop_description),
       status = 'ACTIVE'`,
    [
      DEMO_VENDOR_ID,
      DEMO_USER_ID,
      'Friperie Luxe',
      'Boutique de démo — connexion dashboard vendeur',
      'ACTIVE',
    ],
  );

  const shippingService = new ShippingService(
    new VendorLocationRepository(),
    new VendorShippingRegionRepository(),
  );

  await shippingService.saveVendorShipping(DEMO_VENDOR_ID, {
    location: {
      lat: 6.1375,
      lng: 1.2123,
      city: 'Lomé',
      address: 'Lomé, Togo',
    },
    regions: [
      { region_id: 'maritime', is_home_region: true, price_per_km: 150, min_fee: 500 },
      { region_id: 'plateaux', is_home_region: false, fixed_price: 2500 },
      { region_id: 'centrale', is_home_region: false, fixed_price: 3000 },
      { region_id: 'kara', is_home_region: false, fixed_price: 3500 },
      { region_id: 'savanes', is_home_region: false, fixed_price: 4000 },
    ],
  });

  console.log(`✅ Demo vendor seeded (${DEMO_VENDOR_ID}) — statut ACTIVE`);
  console.log(`   Email    : ${DEMO_VENDOR_CREDENTIALS.email}`);
  console.log(`   Password : ${DEMO_VENDOR_CREDENTIALS.password}`);
}
