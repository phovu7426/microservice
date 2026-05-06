import { PrismaClient } from '../../../src/generated/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function seedCategories(prisma: PrismaClient): Promise<Map<string, bigint>> {
  console.log('🌱 Seeding categories...');
  const data = JSON.parse(readFileSync(join(__dirname, '../data/categories.json'), 'utf-8'));
  const idMap = new Map<string, bigint>();

  for (const item of data) {
    const existing = await prisma.category.findUnique({ where: { slug: item.slug } });
    if (existing) {
      console.log(`  ⏭ Category already exists: ${item.slug}`);
      idMap.set(item.slug, existing.id);
      continue;
    }

    const created = await prisma.category.create({
      data: {
        name: item.name,
        slug: item.slug,
        description: item.description,
      },
    });
    idMap.set(item.slug, created.id);
    console.log(`  ✔ Category: ${item.slug}`);
  }

  console.log(`  ✔ Total categories: ${idMap.size}`);
  return idMap;
}
