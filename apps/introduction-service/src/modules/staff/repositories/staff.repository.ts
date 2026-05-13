import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { toPrimaryKey } from 'src/types';
import { PrismaService } from '../../../core/database/prisma.service';
import { BasicStatus } from '../../../common/enums/status.enum';

export interface StaffFilter {
  search?: string;
  status?: string;
  department?: string;
}

@Injectable()
export class StaffRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: StaffFilter): Prisma.StaffWhereInput {
    const where: Prisma.StaffWhereInput = {};
    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search.slice(0, 100), mode: 'insensitive' } },
        { position: { contains: filter.search.slice(0, 100), mode: 'insensitive' } },
        { department: { contains: filter.search.slice(0, 100), mode: 'insensitive' } },
      ];
    }
    if (filter.status) where.status = filter.status;
    if (filter.department) where.department = filter.department;
    return where;
  }

  findMany(filter: StaffFilter, options: { skip: number; take: number }) {
    return this.prisma.staff.findMany({
      where: this.buildWhere(filter),
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      skip: options.skip,
      take: options.take,
    });
  }

  count(filter: StaffFilter) {
    return this.prisma.staff.count({ where: this.buildWhere(filter) });
  }

  findById(id: any) {
    return this.prisma.staff.findUnique({ where: { id: toPrimaryKey(id) } });
  }

  findActiveById(id: any) {
    return this.prisma.staff.findFirst({
      where: { id: toPrimaryKey(id), status: BasicStatus.active },
    });
  }

  create(data: Record<string, any>) {
    return this.prisma.staff.create({
      data: data as Prisma.StaffUncheckedCreateInput,
    });
  }

  update(id: any, data: Record<string, any>) {
    return this.prisma.staff.update({
      where: { id: toPrimaryKey(id) },
      data: data as Prisma.StaffUncheckedUpdateInput,
    });
  }

  delete(id: any) {
    return this.prisma.staff.delete({ where: { id: toPrimaryKey(id) } });
  }
}
