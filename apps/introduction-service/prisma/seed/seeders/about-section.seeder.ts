import { PrismaClient } from '../../../src/generated/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

const aboutSectionData = JSON.parse(
  readFileSync(join(__dirname, '../data/about-sections.json'), 'utf-8'),
);

export async function seedAboutSections(prisma: PrismaClient) {
  for (const item of aboutSectionData) {
    const existing = await prisma.aboutSection.findUnique({
      where: { slug: item.slug },
    });
    if (existing) {
      console.log(`  ⏭ AboutSection "${item.slug}" already exists, skipping`);
      continue;
    }

    await prisma.aboutSection.create({ data: item });
    console.log(`  ✔ AboutSection: ${item.slug}`);
  }
}
