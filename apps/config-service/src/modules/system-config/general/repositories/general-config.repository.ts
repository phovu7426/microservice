import { Injectable } from '@nestjs/common';
import { GeneralConfig, Prisma } from '../../../../generated/prisma';
import { PrismaService } from '../../../../core/database/prisma.service';

@Injectable()
export class GeneralConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  getConfig(): Promise<GeneralConfig | null> {
    return this.prisma.generalConfig.findFirst();
  }

  async upsert(
    data: Prisma.GeneralConfigCreateInput,
    update: Prisma.GeneralConfigUpdateInput,
  ): Promise<GeneralConfig> {
    const existing = await this.getConfig();
    if (existing) {
      return this.prisma.generalConfig.update({
        where: { id: existing.id },
        data: update,
      });
    }
    return this.prisma.generalConfig.create({ data });
  }

  create(data: Prisma.GeneralConfigCreateInput): Promise<GeneralConfig> {
    return this.prisma.generalConfig.create({ data });
  }

  async update(data: Prisma.GeneralConfigUpdateInput): Promise<GeneralConfig | null> {
    const existing = await this.getConfig();
    if (!existing) return null;
    return this.prisma.generalConfig.update({
      where: { id: existing.id },
      data,
    });
  }
}
