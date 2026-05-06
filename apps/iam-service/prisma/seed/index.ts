import { PrismaClient } from '../../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import {
  seedPermissions,
  seedRoles,
  seedContexts,
  seedGroups,
  seedRoleContexts,
  seedUserAssignments,
} from './seeders';

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== Seeding IAM Service ===\n');

  console.log('1. Seeding permissions...');
  const permMap = await seedPermissions(prisma);
  console.log();

  console.log('2. Seeding roles...');
  const roleMap = await seedRoles(prisma, permMap);
  console.log();

  console.log('3. Seeding contexts...');
  const contextMap = await seedContexts(prisma);
  console.log();

  console.log('4. Seeding groups...');
  const groupMap = await seedGroups(prisma, contextMap);
  console.log();

  console.log('5. Linking roles to contexts...');
  await seedRoleContexts(prisma, roleMap, contextMap);
  console.log();

  console.log('6. Seeding user assignments...');
  await seedUserAssignments(prisma, roleMap, groupMap);
  console.log();

  console.log('=== IAM Seeding complete ===');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
