import { PrismaClient } from '../../../src/generated/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

const staffData = JSON.parse(
  readFileSync(join(__dirname, '../data/staffs.json'), 'utf-8'),
);

export async function seedStaffs(prisma: PrismaClient) {
  for (const item of staffData) {
    const existing = await prisma.staff.findFirst({
      where: { email: item.email },
    });
    if (existing) {
      console.log(`  ⏭ Staff "${item.email}" already exists, skipping`);
      continue;
    }

    await prisma.staff.create({
      data: {
        ...item,
        experience: item.experience != null ? String(item.experience) : null,
        social_links: item.social_links ?? {},
      },
    });
    console.log(`  ✔ Staff: ${item.name}`);
  }
}
