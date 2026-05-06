import { PrismaClient } from '../../../src/generated/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

const certificateData = JSON.parse(
  readFileSync(join(__dirname, '../data/certificates.json'), 'utf-8'),
);

export async function seedCertificates(prisma: PrismaClient) {
  for (const item of certificateData) {
    const existing = await prisma.certificate.findFirst({
      where: { certificate_number: item.certificate_number },
    });
    if (existing) {
      console.log(`  ⏭ Certificate "${item.certificate_number}" already exists, skipping`);
      continue;
    }

    await prisma.certificate.create({
      data: {
        ...item,
        issued_date: item.issued_date ? new Date(item.issued_date) : null,
        expiry_date: item.expiry_date ? new Date(item.expiry_date) : null,
      },
    });
    console.log(`  ✔ Certificate: ${item.name}`);
  }
}
