import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { toPrimaryKey } from 'src/types';
import { PrismaService } from '../../../core/database/prisma.service';
import { BasicStatus } from '../../../common/enums/status.enum';

export interface CertificateFilter {
  search?: string;
  status?: string;
  type?: string;
}

@Injectable()
export class CertificateRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: CertificateFilter): Prisma.CertificateWhereInput {
    const where: Prisma.CertificateWhereInput = {};
    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search.slice(0, 100), mode: 'insensitive' } },
        { issuedBy: { contains: filter.search.slice(0, 100), mode: 'insensitive' } },
      ];
    }
    if (filter.status) where.status = filter.status;
    if (filter.type) where.type = filter.type;
    return where;
  }

  findMany(filter: CertificateFilter, options: { skip: number; take: number }) {
    return this.prisma.certificate.findMany({
      where: this.buildWhere(filter),
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      skip: options.skip,
      take: options.take,
    });
  }

  count(filter: CertificateFilter) {
    return this.prisma.certificate.count({ where: this.buildWhere(filter) });
  }

  findById(id: any) {
    return this.prisma.certificate.findUnique({ where: { id: toPrimaryKey(id) } });
  }

  findActiveById(id: any) {
    return this.prisma.certificate.findFirst({
      where: { id: toPrimaryKey(id), status: BasicStatus.active },
    });
  }

  create(data: Record<string, any>) {
    return this.prisma.certificate.create({
      data: this.normalizePayload(data) as Prisma.CertificateUncheckedCreateInput,
    });
  }

  update(id: any, data: Record<string, any>) {
    return this.prisma.certificate.update({
      where: { id: toPrimaryKey(id) },
      data: this.normalizePayload(data) as Prisma.CertificateUncheckedUpdateInput,
    });
  }

  delete(id: any) {
    return this.prisma.certificate.delete({ where: { id: toPrimaryKey(id) } });
  }

  private normalizePayload(data: Record<string, any>): Record<string, any> {
    const payload = { ...data };
    if (payload.issuedDate && !(payload.issuedDate instanceof Date)) {
      payload.issuedDate = new Date(payload.issuedDate);
    }
    if (payload.expiryDate && !(payload.expiryDate instanceof Date)) {
      payload.expiryDate = new Date(payload.expiryDate);
    }
    return payload;
  }
}
