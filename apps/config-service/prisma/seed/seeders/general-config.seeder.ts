import { PrismaClient } from '../../../src/generated/prisma';
import generalConfigData from '../data/general-configs.json';

export async function seedGeneralConfig(prisma: PrismaClient) {
  const existing = await prisma.generalConfig.findFirst();
  if (existing) {
    console.log('  ⏭ GeneralConfig already exists, skipping');
    return;
  }

  await prisma.generalConfig.create({ data: generalConfigData });
  console.log('  ✔ GeneralConfig created');
}
