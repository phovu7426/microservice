import { PrismaClient } from '../../../src/generated/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

const projectData = JSON.parse(
  readFileSync(join(__dirname, '../data/projects.json'), 'utf-8'),
);

export async function seedProjects(prisma: PrismaClient) {
  for (const item of projectData) {
    const existing = await prisma.project.findUnique({
      where: { slug: item.slug },
    });
    if (existing) {
      console.log(`  ⏭ Project "${item.slug}" already exists, skipping`);
      continue;
    }

    await prisma.project.create({ data: item });
    console.log(`  ✔ Project: ${item.name}`);
  }
}
