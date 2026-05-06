import { PrismaClient } from '../../../src/generated/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

const partnerData = JSON.parse(
  readFileSync(join(__dirname, '../data/partners.json'), 'utf-8'),
);

export async function seedPartners(prisma: PrismaClient) {
  for (const item of partnerData) {
    const existing = await prisma.partner.findFirst({
      where: { name: item.name },
    });
    if (existing) {
      console.log(`  ⏭ Partner "${item.name}" already exists, skipping`);
      continue;
    }

    await prisma.partner.create({ data: item });
    console.log(`  ✔ Partner: ${item.name}`);
  }
}
