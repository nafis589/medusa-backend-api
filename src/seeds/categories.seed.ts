import { randomUUID } from 'crypto';
import { getPool, initializeDatabase, clearDatabase } from '@shared/utils/db';
import { generateSlug } from '@shared/utils/slug';
import { getRedis } from '@shared/utils/redis';

interface SeedCategory {
  name: string;
  slug?: string;
  column_group?: string | null;
  image_url?: string | null;
  position: number;
  children?: SeedCategory[];
}

const SEED_CATEGORIES: SeedCategory[] = [
  {
    name: 'Femme',
    slug: 'femme',
    column_group: null,
    position: 0,
    children: [
      // VÊTEMENTS group
      { name: 'Robes',     column_group: 'VÊTEMENTS', position: 0 },
      { name: 'Tops',      column_group: 'VÊTEMENTS', position: 1 },
      { name: 'Pantalons', column_group: 'VÊTEMENTS', position: 2 },
      { name: 'Vestes',    column_group: 'VÊTEMENTS', position: 3 },
      { name: 'Jupes',     column_group: 'VÊTEMENTS', position: 4 },
      { name: 'Manteaux',  column_group: 'VÊTEMENTS', position: 5 },
      { name: 'Pulls',     column_group: 'VÊTEMENTS', position: 6 },
      // CHAUSSURES group
      { name: 'Escarpins',   column_group: 'CHAUSSURES', position: 7 },
      { name: 'Baskets',     column_group: 'CHAUSSURES', position: 8 },
      { name: 'Bottes',      column_group: 'CHAUSSURES', position: 9 },
      { name: 'Sandales',    column_group: 'CHAUSSURES', position: 10 },
      { name: 'Ballerines',  column_group: 'CHAUSSURES', position: 11 },
      // SACS group
      { name: "Sacs à main",    column_group: 'SACS', position: 12 },
      { name: 'Sacs à dos',     column_group: 'SACS', position: 13 },
      { name: 'Pochettes',      column_group: 'SACS', position: 14 },
      { name: 'Sacs de voyage', column_group: 'SACS', position: 15 },
      // BIJOUX group
      { name: 'Colliers',          column_group: 'BIJOUX', position: 16 },
      { name: 'Bracelets',         column_group: 'BIJOUX', position: 17 },
      { name: 'Bagues',            column_group: 'BIJOUX', position: 18 },
      { name: "Boucles d'oreilles", column_group: 'BIJOUX', position: 19 },
    ],
  },
  {
    name: 'Homme',
    slug: 'homme',
    column_group: null,
    position: 1,
    children: [
      // VÊTEMENTS group
      { name: 'Manteaux',  column_group: 'VÊTEMENTS', position: 0 },
      { name: 'Vestes',    column_group: 'VÊTEMENTS', position: 1 },
      { name: 'Chemises',  column_group: 'VÊTEMENTS', position: 2 },
      { name: 'T-shirts',  column_group: 'VÊTEMENTS', position: 3 },
      { name: 'Polos',     column_group: 'VÊTEMENTS', position: 4 },
      { name: 'Jeans',     column_group: 'VÊTEMENTS', position: 5 },
      { name: 'Pantalons', column_group: 'VÊTEMENTS', position: 6 },
      { name: 'Shorts',    column_group: 'VÊTEMENTS', position: 7 },
      // CHAUSSURES group
      { name: 'Baskets',   column_group: 'CHAUSSURES', position: 8 },
      { name: 'Derbies',   column_group: 'CHAUSSURES', position: 9 },
      { name: 'Bottes',    column_group: 'CHAUSSURES', position: 10 },
      { name: 'Sandales',  column_group: 'CHAUSSURES', position: 11 },
      { name: 'Mocassins', column_group: 'CHAUSSURES', position: 12 },
      // SACS & ACCESSOIRES group
      { name: 'Bags',          column_group: 'SACS & ACCESSOIRES', position: 13 },
      { name: 'Ceintures',     column_group: 'SACS & ACCESSOIRES', position: 14 },
      { name: 'Lunettes',      column_group: 'SACS & ACCESSOIRES', position: 15 },
      { name: 'Cravates',      column_group: 'SACS & ACCESSOIRES', position: 16 },
      { name: 'Portefeuilles', column_group: 'SACS & ACCESSOIRES', position: 17 },
      // MONTRES & BIJOUX group
      { name: 'Montres',              column_group: 'MONTRES & BIJOUX', position: 18 },
      { name: 'Bracelets',            column_group: 'MONTRES & BIJOUX', position: 19 },
      { name: 'Boutons de manchette', column_group: 'MONTRES & BIJOUX', position: 20 },
    ],
  },
  {
    name: 'Enfant',
    slug: 'enfant',
    column_group: null,
    position: 2,
    children: [
      { name: 'Fille',  column_group: null, position: 0 },
      { name: 'Garçon', column_group: null, position: 1 },
      { name: 'Bébé',   column_group: null, position: 2 },
    ],
  },
  {
    name: 'Sacs',
    slug: 'sacs',
    column_group: null,
    position: 3,
    children: [
      { name: 'À main',         column_group: null, position: 0 },
      { name: 'À dos',          column_group: null, position: 1 },
      { name: 'Pochettes',      column_group: null, position: 2 },
      { name: 'Valises',        column_group: null, position: 3 },
      { name: 'Sacs de sport',  column_group: null, position: 4 },
    ],
  },
  {
    name: 'Chaussures',
    slug: 'chaussures',
    column_group: null,
    position: 4,
    children: [
      { name: 'Femme',  column_group: null, position: 0 },
      { name: 'Homme',  column_group: null, position: 1 },
      { name: 'Enfant', column_group: null, position: 2 },
      { name: 'Sport',  column_group: null, position: 3 },
    ],
  },
  {
    name: 'Bijoux & Montres',
    slug: 'bijoux-montres',
    column_group: null,
    position: 5,
    children: [
      { name: 'Colliers',  column_group: null, position: 0 },
      { name: 'Bracelets', column_group: null, position: 1 },
      { name: 'Bagues',    column_group: null, position: 2 },
      { name: 'Montres',   column_group: null, position: 3 },
    ],
  },
  {
    name: 'Électronique',
    slug: 'electronique',
    column_group: null,
    position: 6,
    children: [
      { name: 'Smartphones',   column_group: null, position: 0 },
      { name: 'Ordinateurs',   column_group: null, position: 1 },
      { name: 'Audio',         column_group: null, position: 2 },
      { name: 'Photo',         column_group: null, position: 3 },
      { name: 'Gaming',        column_group: null, position: 4 },
    ],
  },
  {
    name: 'Maison',
    slug: 'maison',
    column_group: null,
    position: 7,
    children: [
      { name: 'Décoration', column_group: null, position: 0 },
      { name: 'Cuisine',    column_group: null, position: 1 },
      { name: 'Linge',      column_group: null, position: 2 },
      { name: 'Mobilier',   column_group: null, position: 3 },
    ],
  },
  {
    name: 'Sport',
    slug: 'sport',
    column_group: null,
    position: 8,
    children: [
      { name: 'Vêtements sport',  column_group: null, position: 0 },
      { name: 'Chaussures sport', column_group: null, position: 1 },
      { name: 'Équipement',       column_group: null, position: 2 },
    ],
  },
];

async function insertCategory(
  pool: Awaited<ReturnType<typeof getPool>>,
  cat: SeedCategory,
  parentId: string | null,
): Promise<void> {
  const slug = cat.slug ?? generateSlug(cat.name);

  const [existing] = await pool.query('SELECT id FROM categories WHERE slug = ? LIMIT 1', [slug]);
  const existingRows = existing as { id: string }[];

  let id: string;
  if (existingRows.length > 0) {
    id = existingRows[0].id;
    await pool.query(
      `UPDATE categories
       SET name = ?, parent_id = ?, column_group = ?, position = ?
       WHERE id = ?`,
      [cat.name, parentId, cat.column_group ?? null, cat.position, id],
    );
  } else {
    id = randomUUID();
    await pool.query(
      `INSERT INTO categories (id, name, slug, parent_id, column_group, image_url, position)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
      [id, cat.name, slug, parentId, cat.column_group ?? null, cat.position],
    );
  }

  if (cat.children && cat.children.length > 0) {
    for (const child of cat.children) {
      await insertCategory(pool, child, id);
    }
  }
}

export async function seedCategories(): Promise<void> {
  const pool = getPool();
  console.log('🌱 Seeding categories...');

  for (const category of SEED_CATEGORIES) {
    await insertCategory(pool, category, null);
  }

  try {
    await getRedis().del('categories:tree');
  } catch {
    // Redis optional during seed
  }

  console.log(`✅ Seeded ${String(SEED_CATEGORIES.length)} root categories with subcategories.`);
}

// Allow running directly: ts-node src/seeds/categories.seed.ts
if (require.main === module) {
  void (async () => {
    await initializeDatabase();
    await clearDatabase();
    await seedCategories();
    process.exit(0);
  })();
}
