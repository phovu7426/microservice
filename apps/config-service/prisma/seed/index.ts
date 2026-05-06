import { PrismaClient } from '../../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import { seedGeneralConfig, seedEmailConfig, seedMenus, seedLocation } from './seeders';

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== Seeding Config Service ===\n');

  console.log('1. Seeding general config...');
  await seedGeneralConfig(prisma);
  console.log();

  console.log('2. Seeding email config...');
  await seedEmailConfig(prisma);
  console.log();

  console.log('3. Seeding menus...');
  await seedMenus(prisma);
  console.log();

  console.log('4. Seeding location (countries, provinces, wards)...');
  await seedLocation(prisma);
  console.log();

  console.log('=== Config Seeding complete ===');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
