import { PrismaClient } from '../../../src/generated/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

const contextsData = JSON.parse(
  readFileSync(join(__dirname, '../data/contexts.json'), 'utf-8'),
);

interface ContextEntry {
  type: string;
  ref_id: number | null;
  name: string;
  code: string;
  status: string;
}

export async function seedContexts(prisma: PrismaClient): Promise<Map<string, bigint>> {
  const codeToId = new Map<string, bigint>();
  const contexts = contextsData as ContextEntry[];

  for (const ctx of contexts) {
    const existing = await prisma.context.findUnique({ where: { code: ctx.code } });
    if (existing) {
      codeToId.set(ctx.code, existing.id);
      continue;
    }

    const created = await prisma.context.create({
      data: {
        type: ctx.type,
        ref_id: ctx.ref_id ? BigInt(ctx.ref_id) : null,
        name: ctx.name,
        code: ctx.code,
        status: ctx.status,
      },
    });
    codeToId.set(ctx.code, created.id);
    console.log(`  ✔ Context: ${ctx.code}`);
  }

  console.log(`  ✔ Total contexts: ${codeToId.size}`);
  return codeToId;
}
