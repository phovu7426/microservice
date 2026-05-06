import { PrismaClient } from '../../../src/generated/prisma';

export async function seedRoleContexts(
  prisma: PrismaClient,
  roleMap: Map<string, bigint>,
  contextMap: Map<string, bigint>,
) {
  for (const [, roleId] of roleMap) {
    for (const [, contextId] of contextMap) {
      const exists = await prisma.roleContext.findUnique({
        where: { role_id_context_id: { role_id: roleId, context_id: contextId } },
      });
      if (!exists) {
        await prisma.roleContext.create({
          data: { role_id: roleId, context_id: contextId },
        });
      }
    }
  }
  console.log(`  ✔ RoleContexts linked`);
}
