import { PrismaClient } from '../../../src/generated/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

const tagData = JSON.parse(
  readFileSync(join(__dirname, '../data/tags.json'), 'utf-8'),
);

interface TagEntry {
  name: string;
  slug: string;
  is_active: boolean;
}

export async function seedTags(prisma: PrismaClient) {
  const tags = tagData as TagEntry[];

  const slugToId = new Map<string, bigint>();

  for (const tag of tags) {
    const existing = await prisma.tag.findUnique({ where: { slug: tag.slug } });

    if (existing) {
      slugToId.set(tag.slug, existing.id);
      continue;
    }

    const record = await prisma.tag.create({
      data: {
        name: tag.name,
        slug: tag.slug,
        is_active: tag.is_active,
      },
    });
    slugToId.set(tag.slug, record.id);
    console.log(`  ✔ Tag: ${tag.name}`);
  }

  console.log(`  ✔ Total tags seeded: ${slugToId.size}`);
  return slugToId;
}
