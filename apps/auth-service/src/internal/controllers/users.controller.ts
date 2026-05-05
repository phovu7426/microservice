import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { Internal, InternalGuard } from '@package/common';
import { toPrimaryKey } from 'src/types';

@Internal()
@UseGuards(InternalGuard)
@Controller('internal/users')
export class InternalUsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getUsersByIds(@Query('ids') ids: string) {
    if (!ids) return [];
    const idList = ids
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .map((id) => toPrimaryKey(id));

    if (!idList.length) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: idList } },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        image: true,
        status: true,
      },
    });

    return users.map((u) => ({
      ...u,
      id: String(u.id),
    }));
  }
}
