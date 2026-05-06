import { PrismaClient } from '../../../src/generated/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

const faqData = JSON.parse(
  readFileSync(join(__dirname, '../data/faqs.json'), 'utf-8'),
);

export async function seedFaqs(prisma: PrismaClient) {
  for (const item of faqData) {
    const existing = await prisma.faq.findFirst({
      where: { question: item.question },
    });
    if (existing) {
      console.log(`  ⏭ FAQ "${item.question.substring(0, 30)}..." already exists, skipping`);
      continue;
    }

    await prisma.faq.create({ data: item });
    console.log(`  ✔ FAQ: ${item.question.substring(0, 30)}...`);
  }
}
