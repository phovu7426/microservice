import { PrismaClient } from '../../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import { seedCategories, seedComics } from './seeders';

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== Seeding Comic Service ===\n');

  console.log('1. Seeding categories...');
  const categoryIdMap = await seedCategories(prisma);
  console.log();

  console.log('2. Seeding comics...');
  await seedComics(prisma, categoryIdMap);
  console.log();

  console.log('=== Comic Seeding complete ===');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
