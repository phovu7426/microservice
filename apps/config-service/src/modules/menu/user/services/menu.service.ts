import { Injectable } from '@nestjs/common';
import { IamClient } from '../../../../clients/iam.client';
import { MenuRepository, MenuFilter } from '../../repositories/menu.repository';
import { MenuTreeItem } from '../../interfaces/menu-tree-item.interface';
import { buildMenuTree, filterUserMenus } from '../../helpers/menu.helper';
import { BasicStatus } from '../../enums/basic-status.enum';

@Injectable()
export class UserMenuService {
  constructor(
    private readonly menuRepo: MenuRepository,
    private readonly iamClient: IamClient,
  ) {}

  async getUserMenuTree(userId: string, groupId?: string): Promise<MenuTreeItem[]> {
    const userPermissions = await this.iamClient.getUserPermissions(userId, groupId);
    const dbFilter: MenuFilter = { status: BasicStatus.active, group: 'admin' };
    const allMenus = await this.menuRepo.findAllWithChildren(dbFilter);
    const visible = allMenus.filter((m: any) => m.showInMenu);
    const filtered = filterUserMenus(visible, userPermissions);
    return buildMenuTree(filtered);
  }
}
