import { PrismaClient } from '../../../src/generated/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

const bannerLocationData = JSON.parse(
  readFileSync(join(__dirname, '../data/banner-locations.json'), 'utf-8'),
);

interface BannerLocationEntry {
  code: string;
  name: string;
  description?: string | null;
  status: string;
}

export async function seedBannerLocations(prisma: PrismaClient): Promise<Map<string, bigint>> {
  const locations = bannerLocationData as BannerLocationEntry[];
  const codeToId = new Map<string, bigint>();

  for (const location of locations) {
    const existing = await prisma.bannerLocation.findUnique({ where: { code: location.code } });

    if (existing) {
      console.log(`  ⏭ BannerLocation: ${location.code} already exists, skipping`);
      codeToId.set(location.code, existing.id);
      continue;
    }

    const record = await prisma.bannerLocation.create({
      data: {
        code: location.code,
        name: location.name,
        description: location.description ?? null,
        status: location.status,
      },
    });

    console.log(`  ✔ BannerLocation: ${location.code}`);
    codeToId.set(location.code, record.id);
  }

  console.log(`  ✔ Total banner locations seeded: ${codeToId.size}`);
  return codeToId;
}
