import { PrismaClient } from '../../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import { seedContentTemplates, seedNotifications, seedComicFollowers } from './seeders';

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== Seeding Notification Service ===\n');

  console.log('1. Seeding content templates...');
  await seedContentTemplates(prisma);
  console.log();

  console.log('2. Seeding sample notifications...');
  await seedNotifications(prisma);
  console.log();

  console.log('3. Seeding comic followers projection...');
  await seedComicFollowers(prisma);
  console.log();

  console.log('=== Notification Seeding complete ===');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
