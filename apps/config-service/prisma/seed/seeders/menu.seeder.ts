import { PrismaClient } from '../../../src/generated/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

const menuData = JSON.parse(
  readFileSync(join(__dirname, '../data/menus.json'), 'utf-8'),
);

interface MenuEntry {
  code: string;
  name: string;
  path?: string | null;
  api_path?: string | null;
  icon?: string | null;
  type: string;
  status: string;
  parent_id?: number | null;
  parent_code?: string;
  sort_order: number;
  is_public: boolean;
  show_in_menu: boolean;
  group?: string;
  required_permission_code?: string | null;
}

export async function seedMenus(prisma: PrismaClient) {
  const menus = menuData as MenuEntry[];

  // First pass: upsert all menus without parent relationships
  const codeToId = new Map<string, bigint>();

  for (const menu of menus) {
    const data = {
      code: menu.code,
      name: menu.name,
      path: menu.path ?? null,
      apiPath: menu.api_path ?? null,
      icon: menu.icon ?? null,
      type: menu.type,
      status: menu.status,
      sortOrder: menu.sort_order,
      isPublic: menu.is_public,
      showInMenu: menu.show_in_menu,
      group: menu.group ?? 'admin',
      requiredPermissionCode: menu.required_permission_code ?? null,
      parentId: null as bigint | null,
    };

    const existing = await prisma.menu.findUnique({ where: { code: menu.code } });

    let record;
    if (existing) {
      record = await prisma.menu.update({ where: { code: menu.code }, data });
    } else {
      record = await prisma.menu.create({ data });
      console.log(`  ✔ Menu: ${menu.code}`);
    }
    codeToId.set(menu.code, record.id);
  }

  // Second pass: update parent relationships
  for (const menu of menus) {
    if (menu.parent_code) {
      const parentId = codeToId.get(menu.parent_code);
      if (parentId) {
        await prisma.menu.update({
          where: { code: menu.code },
          data: { parentId },
        });
      }
    }
  }

  console.log(`  ✔ Total menus seeded: ${codeToId.size}`);
}
