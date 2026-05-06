import { PrismaClient } from '../../../src/generated/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

const categoryData = JSON.parse(
  readFileSync(join(__dirname, '../data/categories.json'), 'utf-8'),
);

interface CategoryEntry {
  name: string;
  slug: string;
  description?: string | null;
  is_active: boolean;
  sort_order: number;
  parent_slug?: string;
}

export async function seedCategories(prisma: PrismaClient) {
  const categories = categoryData as CategoryEntry[];

  // First pass: upsert all categories without parent relationships
  const slugToId = new Map<string, bigint>();

  for (const category of categories) {
    const data = {
      name: category.name,
      slug: category.slug,
      description: category.description ?? null,
      is_active: category.is_active,
      sort_order: category.sort_order,
      parent_id: null as bigint | null,
    };

    const existing = await prisma.category.findUnique({ where: { slug: category.slug } });

    let record;
    if (existing) {
      record = await prisma.category.update({ where: { slug: category.slug }, data });
    } else {
      record = await prisma.category.create({ data });
      console.log(`  ✔ Category: ${category.name}`);
    }
    slugToId.set(category.slug, record.id);
  }

  // Second pass: update parent relationships
  for (const category of categories) {
    if (category.parent_slug) {
      const parentId = slugToId.get(category.parent_slug);
      if (parentId) {
        await prisma.category.update({
          where: { slug: category.slug },
          data: { parent_id: parentId },
        });
      }
    }
  }

  console.log(`  ✔ Total categories seeded: ${slugToId.size}`);
  return slugToId;
}
