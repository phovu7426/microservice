import { Body, Controller, Get, Post, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { RbacService } from '../../rbac/services/rbac.service';
import { RbacCheckDto } from '../dtos/rbac-check.dto';
import { RbacPermissionsQueryDto } from '../dtos/rbac-permissions-query.dto';
import { Internal, InternalGuard } from '@package/common';

@Internal()
@UseGuards(InternalGuard)
@Controller('internal/rbac')
export class InternalRbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Post('check')
  async checkPermissions(@Body() body: RbacCheckDto) {
    const { userId, groupId, permissions } = body;
    if (!permissions?.length) return { allowed: false };

    const allowed = await this.rbacService.hasPermissions(
      userId,
      groupId ?? null,
      permissions,
    );
    return { allowed };
  }

  @Get('permissions')
  async getPermissions(@Query(ValidationPipe) query: RbacPermissionsQueryDto) {
    const permSet = await this.rbacService.getPermissions(
      query.userId,
      query.groupId ?? null,
    );
    return { permissions: Array.from(permSet) };
  }
}
