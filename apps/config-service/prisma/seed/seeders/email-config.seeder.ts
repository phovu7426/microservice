import { PrismaClient } from '../../../src/generated/prisma';
import emailConfigData from '../data/email-configs.json';

export async function seedEmailConfig(prisma: PrismaClient) {
  const existing = await prisma.emailConfig.findFirst();
  if (existing) {
    console.log('  ⏭ EmailConfig already exists, skipping');
    return;
  }

  await prisma.emailConfig.create({ data: emailConfigData });
  console.log('  ✔ EmailConfig created');
}
