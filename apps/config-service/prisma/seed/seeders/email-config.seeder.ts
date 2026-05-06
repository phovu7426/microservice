import { PrismaClient } from '../../../src/generated/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

const emailConfigData = JSON.parse(
  readFileSync(join(__dirname, '../data/email-configs.json'), 'utf-8'),
);

export async function seedEmailConfig(prisma: PrismaClient) {
  const existing = await prisma.emailConfig.findFirst();
  if (existing) {
    console.log('  ⏭ EmailConfig already exists, skipping');
    return;
  }

  await prisma.emailConfig.create({ data: emailConfigData });
  console.log('  ✔ EmailConfig created');
}
