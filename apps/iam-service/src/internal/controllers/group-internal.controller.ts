import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Internal, InternalGuard, ParseBigIntPipe, ResponseUtil } from '@package/common';
import { GroupRepository } from '../../modules/group/repositories/group.repository';

@Internal()
@UseGuards(InternalGuard)
@Controller('internal/groups')
export class GroupInternalController {
  constructor(private readonly groupRepo: GroupRepository) {}

  @Get(':id/member-ids')
  async getMemberIds(@Param('id', ParseBigIntPipe) id: bigint) {
    const userIds = await this.groupRepo.findMemberIds(id);
    return ResponseUtil.success({ userIds: userIds.map(String) });
  }
}
