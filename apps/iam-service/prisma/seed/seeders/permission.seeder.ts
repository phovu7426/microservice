import { PrismaClient } from '../../../src/generated/prisma';
import permissionsData from '../data/permissions.json';

interface PermEntry {
  code: string;
  name: string;
  status: string;
  parent_code: string | null;
}

export async function seedPermissions(prisma: PrismaClient): Promise<Map<string, bigint>> {
  const codeToId = new Map<string, bigint>();
  const permissions = permissionsData as PermEntry[];

  // First pass: upsert all permissions without parent
  for (const perm of permissions) {
    const existing = await prisma.permission.findUnique({ where: { code: perm.code } });
    if (existing) {
      codeToId.set(perm.code, existing.id);
      continue;
    }

    const created = await prisma.permission.create({
      data: {
        code: perm.code,
        name: perm.name,
        scope: 'context',
        status: perm.status,
      },
    });
    codeToId.set(perm.code, created.id);
    console.log(`  ✔ Permission: ${perm.code}`);
  }

  // Second pass: update parent relationships
  for (const perm of permissions) {
    if (perm.parent_code) {
      const parentId = codeToId.get(perm.parent_code);
      if (parentId) {
        await prisma.permission.update({
          where: { code: perm.code },
          data: { parent_id: parentId },
        });
      }
    }
  }

  console.log(`  ✔ Total permissions: ${codeToId.size}`);
  return codeToId;
}
