import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { PrismaService } from '../../../core/database/prisma.service';
import { toPrimaryKey } from 'src/types';

export interface RoleFilter {
  search?: string;
  status?: string;
  parent_id?: any;
}

const LIST_SELECT = {
  id: true,
  code: true,
  name: true,
  status: true,
  parent_id: true,
  parent: { select: { id: true, code: true, name: true } },
  created_at: true,
} satisfies Prisma.RoleSelect;

@Injectable()
export class RoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: RoleFilter): Prisma.RoleWhereInput {
    const where: Prisma.RoleWhereInput = {};
    const andConditions: Prisma.RoleWhereInput[] = [];

    if (filter.search) {
      andConditions.push({
        OR: [
          { code: { startsWith: filter.search, mode: 'insensitive' } },
          { name: { startsWith: filter.search, mode: 'insensitive' } },
        ],
      });
    }

    if (filter.status) {
      andConditions.push({ status: filter.status });
    }

    if (filter.parent_id) {
      andConditions.push({ parent_id: toPrimaryKey(filter.parent_id) });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    return where;
  }

  findMany(filter: RoleFilter, options: { skip: number; take: number; orderBy?: any }) {
    return this.prisma.role.findMany({
      where: this.buildWhere(filter),
      select: LIST_SELECT,
      skip: options.skip,
      take: options.take,
      orderBy: options.orderBy ?? { code: 'asc' },
    });
  }

  count(filter: RoleFilter) {
    return this.prisma.role.count({ where: this.buildWhere(filter) });
  }

  findById(id: string | bigint) {
    return this.prisma.role.findUnique({
      where: { id: toPrimaryKey(id) },
      include: {
        parent: { select: { id: true, code: true, name: true } },
        permissions: {
          include: { permission: { select: { id: true, code: true, name: true } } },
        },
        role_contexts: {
          include: { context: { select: { id: true, code: true, name: true } } },
        },
      },
    });
  }

  findByCode(code: string) {
    return this.prisma.role.findFirst({ where: { code } });
  }

  create(data: any) {
    return this.prisma.role.create({ data });
  }

  update(id: string | bigint, data: any) {
    return this.prisma.role.update({ where: { id: toPrimaryKey(id) }, data });
  }

  delete(id: string | bigint) {
    return this.prisma.role.delete({ where: { id: toPrimaryKey(id) } });
  }

  async syncPermissions(roleId: string | bigint, permissionIds: (string | bigint)[]) {
    const pkRoleId = toPrimaryKey(roleId);
    const pkPermIds = permissionIds.map(toPrimaryKey);
    await this.prisma.$transaction(
      async (tx) => {
        await tx.roleHasPermission.deleteMany({ where: { role_id: pkRoleId } });
        if (pkPermIds.length) {
          await tx.roleHasPermission.createMany({
            data: pkPermIds.map((pid) => ({ role_id: pkRoleId, permission_id: pid })),
            skipDuplicates: true,
          });
        }
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async getParentId(id: bigint): Promise<bigint | null> {
    const row = await this.prisma.role.findUnique({
      where: { id },
      select: { parent_id: true },
    });
    return row?.parent_id ?? null;
  }

  async getPermissionCodesByIds(ids: (string | bigint)[]): Promise<string[]> {
    if (!ids.length) return [];
    const rows = await this.prisma.permission.findMany({
      where: { id: { in: ids.map(toPrimaryKey) }, status: 'active' },
      select: { code: true },
    });
    return rows.map((r) => r.code);
  }
}
