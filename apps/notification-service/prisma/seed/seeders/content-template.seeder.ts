import { PrismaClient, Prisma } from '../../../src/generated/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

const templatesData = JSON.parse(
  readFileSync(join(__dirname, '../data/content-templates.json'), 'utf-8'),
);

interface TemplateEntry {
  code: string;
  name: string;
  type: string;
  category: string;
  status: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export async function seedContentTemplates(prisma: PrismaClient) {
  const templates = templatesData as TemplateEntry[];

  for (const t of templates) {
    const existing = await prisma.contentTemplate.findUnique({ where: { code: t.code } });
    if (existing) {
      console.log(`  ⏭ Template: ${t.code} already exists, skipping`);
      continue;
    }

    await prisma.contentTemplate.create({
      data: {
        code: t.code,
        name: t.name,
        category: t.category,
        type: t.type,
        content: t.content,
        metadata: (t.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        status: t.status,
      },
    });
    console.log(`  ✔ Template: ${t.code}`);
  }
}
