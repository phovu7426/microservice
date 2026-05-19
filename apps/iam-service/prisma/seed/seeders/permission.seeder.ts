import { PrismaClient } from '../../../src/generated/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

const permissionsData = JSON.parse(
  readFileSync(join(__dirname, '../data/permissions.json'), 'utf-8'),
);

interface PermEntry {
  code: string;
  name: string;
  status: string;
  parent_code: string | null;
}

// Permissions renamed — delete from DB before re-seeding to keep data clean.
const DEPRECATED_CODES = [
  'banner.manage', 'banner_location.manage',
  'contact.manage', 'project.manage', 'about.manage',
  'staff.manage', 'testimonial.manage', 'partner.manage',
  'gallery.manage', 'certificate.manage', 'faq.manage',
];

export async function seedPermissions(prisma: PrismaClient): Promise<Map<string, bigint>> {
  const codeToId = new Map<string, bigint>();
  const permissions = permissionsData as PermEntry[];

  // Cleanup deprecated codes (remove role assignments first to avoid FK violation)
  for (const code of DEPRECATED_CODES) {
    const perm = await prisma.permission.findUnique({ where: { code } });
    if (perm) {
      await prisma.roleHasPermission.deleteMany({ where: { permissionId: perm.id } });
      await prisma.permission.delete({ where: { code } });
      console.log(`  ✘ Deprecated: ${code}`);
    }
  }

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
          data: { parentId: parentId },
        });
      }
    }
  }

  console.log(`  ✔ Total permissions: ${codeToId.size}`);
  return codeToId;
}
