import { PrismaClient } from '../../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import { seedBannerLocations, seedBanners } from './seeders';

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== Seeding Marketing Service ===\n');

  console.log('1. Seeding banner locations...');
  const locationIdMap = await seedBannerLocations(prisma);
  console.log();

  console.log('2. Seeding banners...');
  await seedBanners(prisma, locationIdMap);
  console.log();

  console.log('=== Marketing Seeding complete ===');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
