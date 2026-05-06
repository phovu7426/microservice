import { PrismaClient } from '../../../src/generated/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function seedComics(
  prisma: PrismaClient,
  categoryIdMap: Map<string, bigint>,
): Promise<Map<string, bigint>> {
  console.log('🌱 Seeding comics...');
  const data = JSON.parse(readFileSync(join(__dirname, '../data/comics.json'), 'utf-8'));
  const idMap = new Map<string, bigint>();

  for (const item of data) {
    const existing = await prisma.comic.findUnique({ where: { slug: item.slug } });
    if (existing) {
      console.log(`  ⏭ Comic already exists: ${item.slug}`);
      idMap.set(item.slug, existing.id);
      continue;
    }

    const { categories, ...comicData } = item;

    const created = await prisma.comic.create({
      data: comicData,
    });
    idMap.set(item.slug, created.id);
    console.log(`  ✔ Comic: ${item.slug}`);

    // Create comic-category relationships
    if (categories && categories.length > 0) {
      for (const catSlug of categories) {
        const categoryId = categoryIdMap.get(catSlug);
        if (categoryId) {
          await prisma.comicCategory.create({
            data: {
              comic_id: created.id,
              category_id: categoryId,
            },
          });
          console.log(`    ✔ Linked category: ${catSlug}`);
        }
      }
    }
  }

  console.log(`  ✔ Total comics: ${idMap.size}`);
  return idMap;
}
