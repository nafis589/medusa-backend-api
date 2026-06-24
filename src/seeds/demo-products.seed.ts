import { randomUUID } from 'crypto';
import { getPool } from '@shared/utils/db';
import { DEMO_VENDOR_ID } from './demo-vendor.seed';

interface SeedProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  category_slug: string;
  brand: string;
  condition: 'NEW' | 'VERY_GOOD' | 'GOOD' | 'FAIR';
  material: string;
  color: string;
  size: string;
  views_count: number;
  image_url: string | null;
}

const DEMO_PRODUCTS: SeedProduct[] = [
  {
    id: 'c0000000-0000-4000-8000-000000000001',
    title: 'Robe wax pagne traditionnelle',
    description: 'Robe élégante en wax authentique, parfaite pour les cérémonies.',
    price: 15000,
    category_slug: 'robes',
    brand: 'Afro Style',
    condition: 'VERY_GOOD',
    material: 'Coton wax',
    color: 'Multicolore',
    size: 'M',
    views_count: 42,
    image_url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600',
  },
  {
    id: 'c0000000-0000-4000-8000-000000000002',
    title: 'Sac à main cuir vintage',
    description: 'Sac en cuir véritable, bon état général.',
    price: 22000,
    category_slug: 'sacs-a-main',
    brand: 'Vintage',
    condition: 'GOOD',
    material: 'Cuir',
    color: 'Marron',
    size: 'Unique',
    views_count: 28,
    image_url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600',
  },
  {
    id: 'c0000000-0000-4000-8000-000000000003',
    title: 'Escarpins noirs talons',
    description: 'Escarpins classiques pour soirée ou bureau.',
    price: 18000,
    category_slug: 'escarpins',
    brand: 'Elegance',
    condition: 'VERY_GOOD',
    material: 'Cuir synthétique',
    color: 'Noir',
    size: '38',
    views_count: 19,
    image_url: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600',
  },
  {
    id: 'c0000000-0000-4000-8000-000000000004',
    title: 'Pantalon tailleur beige',
    description: 'Pantalon droit tailleur, coupe moderne.',
    price: 12000,
    category_slug: 'pantalons',
    brand: 'Classique',
    condition: 'GOOD',
    material: 'Polyester',
    color: 'Beige',
    size: 'L',
    views_count: 11,
    image_url: null,
  },
  {
    id: 'c0000000-0000-4000-8000-000000000005',
    title: 'Veste en jean oversize',
    description: 'Veste denim délavée, style casual.',
    price: 14000,
    category_slug: 'vestes',
    brand: 'Denim Co',
    condition: 'VERY_GOOD',
    material: 'Denim',
    color: 'Bleu',
    size: 'M',
    views_count: 35,
    image_url: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=600',
  },
  {
    id: 'c0000000-0000-4000-8000-000000000006',
    title: 'Top en soie imprimé',
    description: 'Top léger en soie, imprimé floral.',
    price: 9500,
    category_slug: 'tops',
    brand: 'Soie & Co',
    condition: 'NEW',
    material: 'Soie',
    color: 'Rose',
    size: 'S',
    views_count: 8,
    image_url: 'https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=600',
  },
  {
    id: 'c0000000-0000-4000-8000-000000000007',
    title: 'Baskets blanches casual',
    description: 'Baskets confortables au quotidien.',
    price: 16000,
    category_slug: 'baskets',
    brand: 'Urban Step',
    condition: 'GOOD',
    material: 'Textile',
    color: 'Blanc',
    size: '40',
    views_count: 22,
    image_url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600',
  },
  {
    id: 'c0000000-0000-4000-8000-000000000008',
    title: 'Collier perles artisanal',
    description: 'Collier fait main, perles naturelles.',
    price: 7500,
    category_slug: 'colliers',
    brand: 'Artisan Togo',
    condition: 'NEW',
    material: 'Perles',
    color: 'Blanc',
    size: 'Unique',
    views_count: 6,
    image_url: null,
  },
  {
    id: 'c0000000-0000-4000-8000-000000000009',
    title: 'Manteau long hiver',
    description: 'Manteau chaud longue coupe.',
    price: 35000,
    category_slug: 'manteaux',
    brand: 'Winter Lux',
    condition: 'VERY_GOOD',
    material: 'Laine',
    color: 'Noir',
    size: 'L',
    views_count: 15,
    image_url: 'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=600',
  },
  {
    id: 'c0000000-0000-4000-8000-000000000010',
    title: 'Jupe plissée midi',
    description: 'Jupe plissée élégante mi-longueur.',
    price: 11000,
    category_slug: 'jupes',
    brand: 'Chic',
    condition: 'GOOD',
    material: 'Viscose',
    color: 'Vert',
    size: 'M',
    views_count: 9,
    image_url: 'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=600',
  },
];

async function findCategoryId(slug: string): Promise<string | null> {
  const db = getPool();
  const [rows] = await db.query('SELECT id FROM categories WHERE slug = ? LIMIT 1', [slug]);
  const results = rows as { id: string }[];
  return results.length > 0 ? results[0].id : null;
}

export async function seedDemoProducts(): Promise<void> {
  const db = getPool();

  const [vendorRows] = await db.query('SELECT id FROM vendors WHERE id = ?', [DEMO_VENDOR_ID]);
  if ((vendorRows as { id: string }[]).length === 0) {
    console.log('⚠️  Demo vendor not found — run seedDemoVendor first. Skipping products.');
    return;
  }

  await db.query(
    `DELETE pi FROM product_images pi
     INNER JOIN products p ON p.id = pi.product_id
     WHERE p.vendor_id = ?`,
    [DEMO_VENDOR_ID],
  );
  await db.query('DELETE FROM products WHERE vendor_id = ?', [DEMO_VENDOR_ID]);

  let inserted = 0;

  for (const product of DEMO_PRODUCTS) {
    const categoryId = await findCategoryId(product.category_slug);

    await db.query(
      `INSERT INTO products (
        id, vendor_id, title, description, price, category_id, brand,
        \`condition\`, material, color, size, status, views_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
      [
        product.id,
        DEMO_VENDOR_ID,
        product.title,
        product.description,
        product.price,
        categoryId,
        product.brand,
        product.condition,
        product.material,
        product.color,
        product.size,
        product.views_count,
      ],
    );

    if (product.image_url) {
      await db.query(
        `INSERT INTO product_images (id, product_id, url, position, is_primary)
         VALUES (?, ?, ?, 0, TRUE)`,
        [randomUUID(), product.id, product.image_url],
      );
    }

    inserted += 1;
  }

  console.log(`✅ Seeded ${String(inserted)} demo products (ACTIVE) for storefront.`);
}
