import { PrismaClient } from '../../../src/generated/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

const generalConfigData = JSON.parse(
  readFileSync(join(__dirname, '../data/general-configs.json'), 'utf-8'),
);

export async function seedGeneralConfig(prisma: PrismaClient) {
  const existing = await prisma.generalConfig.findFirst();
  if (existing) {
    console.log('  ⏭ GeneralConfig already exists, skipping');
    return;
  }

  await prisma.generalConfig.create({ data: generalConfigData });
  console.log('  ✔ GeneralConfig created');
}
