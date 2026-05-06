import { PrismaClient } from '../../../src/generated/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

const galleryData = JSON.parse(
  readFileSync(join(__dirname, '../data/galleries.json'), 'utf-8'),
);

export async function seedGalleries(prisma: PrismaClient) {
  for (const item of galleryData) {
    const existing = await prisma.gallery.findUnique({
      where: { slug: item.slug },
    });
    if (existing) {
      console.log(`  ⏭ Gallery "${item.slug}" already exists, skipping`);
      continue;
    }

    await prisma.gallery.create({
      data: {
        ...item,
        images: item.images ?? [],
      },
    });
    console.log(`  ✔ Gallery: ${item.title}`);
  }
}
