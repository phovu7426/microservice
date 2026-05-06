import { PrismaClient } from '../../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import { seedCategories, seedTags, seedPosts } from './seeders';

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== Seeding Post Service ===\n');

  console.log('1. Seeding categories...');
  const categorySlugToId = await seedCategories(prisma);
  console.log();

  console.log('2. Seeding tags...');
  const tagSlugToId = await seedTags(prisma);
  console.log();

  console.log('3. Seeding posts...');
  await seedPosts(prisma, categorySlugToId, tagSlugToId);
  console.log();

  console.log('=== Post Seeding complete ===');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
