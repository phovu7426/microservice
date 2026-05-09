import { Injectable } from '@nestjs/common';
import { GroupRepository } from '../../repositories/group.repository';
import { toPrimaryKey } from 'src/types';

@Injectable()
export class UserGroupService {
  constructor(private readonly repo: GroupRepository) {}

  async getUserGroups(userId: string) {
    const rows = await this.repo.findUserGroups(toPrimaryKey(userId));
    return rows.map((r) => ({ ...r.group, joined_at: r.joined_at }));
  }
}
