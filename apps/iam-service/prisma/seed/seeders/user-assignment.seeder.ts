import { PrismaClient } from '../../../src/generated/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

const usersData = JSON.parse(
  readFileSync(join(__dirname, '../data/users.json'), 'utf-8'),
);

interface UserEntry {
  user_id: number;
  username: string;
  group_code: string;
  role_code: string;
}

export async function seedUserAssignments(
  prisma: PrismaClient,
  roleMap: Map<string, bigint>,
  groupMap: Map<string, bigint>,
) {
  const users = usersData as UserEntry[];

  for (const user of users) {
    if (!user.group_code || !user.role_code) continue;

    const userId = BigInt(user.user_id);
    const groupId = groupMap.get(user.group_code);
    const roleId = roleMap.get(user.role_code);

    if (!groupId || !roleId) {
      console.log(`  ⚠ User ${user.username}: skipped (group or role not found)`);
      continue;
    }

    // UserGroup
    const ugExists = await prisma.userGroup.findUnique({
      where: { user_id_group_id: { user_id: userId, group_id: groupId } },
    });
    if (!ugExists) {
      await prisma.userGroup.create({ data: { user_id: userId, group_id: groupId } });
      console.log(`  ✔ UserGroup: ${user.username} → ${user.group_code}`);
    }

    // UserRoleAssignment
    const uraExists = await prisma.userRoleAssignment.findFirst({
      where: { user_id: userId, role_id: roleId, group_id: groupId },
    });
    if (!uraExists) {
      await prisma.userRoleAssignment.create({
        data: { user_id: userId, role_id: roleId, group_id: groupId },
      });
      console.log(`  ✔ UserRoleAssignment: ${user.username} → ${user.role_code} @ ${user.group_code}`);
    }
  }
}
