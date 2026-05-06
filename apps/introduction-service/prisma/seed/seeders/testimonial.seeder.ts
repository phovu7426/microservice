import { PrismaClient } from '../../../src/generated/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

const testimonialData = JSON.parse(
  readFileSync(join(__dirname, '../data/testimonials.json'), 'utf-8'),
);

export async function seedTestimonials(prisma: PrismaClient) {
  for (const item of testimonialData) {
    const existing = await prisma.testimonial.findFirst({
      where: {
        client_name: item.client_name,
        client_company: item.client_company,
      },
    });
    if (existing) {
      console.log(`  ⏭ Testimonial "${item.client_name}" already exists, skipping`);
      continue;
    }

    await prisma.testimonial.create({ data: item });
    console.log(`  ✔ Testimonial: ${item.client_name}`);
  }
}
