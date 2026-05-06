import { PrismaClient } from '../../../src/generated/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

const rolesData = JSON.parse(
  readFileSync(join(__dirname, '../data/roles.json'), 'utf-8'),
);

interface RoleEntry {
  code: string;
  name: string;
  status: string;
  parent_code: string | null;
}

export async function seedRoles(
  prisma: PrismaClient,
  permMap: Map<string, bigint>,
): Promise<Map<string, bigint>> {
  const codeToId = new Map<string, bigint>();
  const roles = rolesData as RoleEntry[];

  // First pass: create roles
  for (const r of roles) {
    const existing = await prisma.role.findUnique({ where: { code: r.code } });
    if (existing) {
      codeToId.set(r.code, existing.id);
      continue;
    }

    const created = await prisma.role.create({
      data: {
        code: r.code,
        name: r.name,
        status: r.status,
      },
    });
    codeToId.set(r.code, created.id);
    console.log(`  ✔ Role: ${r.code}`);
  }

  // Second pass: update parent relationships
  for (const r of roles) {
    if (r.parent_code) {
      const parentId = codeToId.get(r.parent_code);
      if (parentId) {
        await prisma.role.update({
          where: { code: r.code },
          data: { parent_id: parentId },
        });
      }
    }
  }

  // Assign all permissions to super_admin
  const superAdminId = codeToId.get('super_admin');
  if (superAdminId) {
    await prisma.roleHasPermission.deleteMany({ where: { role_id: superAdminId } });
    const allPermIds = Array.from(permMap.values());
    if (allPermIds.length > 0) {
      await prisma.roleHasPermission.createMany({
        data: allPermIds.map((pid) => ({ role_id: superAdminId, permission_id: pid })),
        skipDuplicates: true,
      });
    }
    console.log(`  ✔ super_admin → ${allPermIds.length} permissions linked`);
  }

  // Assign comic/post related permissions to group_owner
  const groupOwnerId = codeToId.get('group_owner');
  if (groupOwnerId) {
    const ownerPermCodes = [
      'comic.manage', 'comic.view', 'comic.create', 'comic.update', 'comic.delete', 'comic.approve',
      'chapter.view', 'chapter.create', 'chapter.update', 'chapter.delete',
      'post.manage', 'post_category.manage', 'post_tag.manage',
      'notification.manage', 'notification.view', 'notification.send',
      'group.manage', 'group.member.manage', 'group.member.add', 'group.member.remove',
    ];
    await prisma.roleHasPermission.deleteMany({ where: { role_id: groupOwnerId } });
    const ownerPermIds = ownerPermCodes
      .map((c) => permMap.get(c))
      .filter((id): id is bigint => id !== undefined);
    if (ownerPermIds.length > 0) {
      await prisma.roleHasPermission.createMany({
        data: ownerPermIds.map((pid) => ({ role_id: groupOwnerId, permission_id: pid })),
        skipDuplicates: true,
      });
    }
    console.log(`  ✔ group_owner → ${ownerPermIds.length} permissions linked`);
  }

  // Assign comic edit permissions to group_editor
  const groupEditorId = codeToId.get('group_editor');
  if (groupEditorId) {
    const editorPermCodes = [
      'comic.view', 'comic.create', 'comic.update',
      'chapter.view', 'chapter.create', 'chapter.update',
      'post.manage', 'post_category.manage', 'post_tag.manage',
    ];
    await prisma.roleHasPermission.deleteMany({ where: { role_id: groupEditorId } });
    const editorPermIds = editorPermCodes
      .map((c) => permMap.get(c))
      .filter((id): id is bigint => id !== undefined);
    if (editorPermIds.length > 0) {
      await prisma.roleHasPermission.createMany({
        data: editorPermIds.map((pid) => ({ role_id: groupEditorId, permission_id: pid })),
        skipDuplicates: true,
      });
    }
    console.log(`  ✔ group_editor → ${editorPermIds.length} permissions linked`);
  }

  // Assign upload permissions to group_uploader
  const groupUploaderId = codeToId.get('group_uploader');
  if (groupUploaderId) {
    const uploaderPermCodes = [
      'comic.view', 'chapter.view', 'chapter.create', 'chapter.update',
    ];
    await prisma.roleHasPermission.deleteMany({ where: { role_id: groupUploaderId } });
    const uploaderPermIds = uploaderPermCodes
      .map((c) => permMap.get(c))
      .filter((id): id is bigint => id !== undefined);
    if (uploaderPermIds.length > 0) {
      await prisma.roleHasPermission.createMany({
        data: uploaderPermIds.map((pid) => ({ role_id: groupUploaderId, permission_id: pid })),
        skipDuplicates: true,
      });
    }
    console.log(`  ✔ group_uploader → ${uploaderPermIds.length} permissions linked`);
  }

  console.log(`  ✔ Total roles: ${codeToId.size}`);
  return codeToId;
}
