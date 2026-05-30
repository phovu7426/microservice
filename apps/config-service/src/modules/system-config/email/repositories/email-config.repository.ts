import { Injectable } from '@nestjs/common';
import { EmailConfig, Prisma } from '../../../../generated/prisma';
import { PrismaService } from '../../../../core/database/prisma.service';

@Injectable()
export class EmailConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  getConfig(): Promise<EmailConfig | null> {
    return this.prisma.emailConfig.findFirst();
  }

  async upsert(
    data: Prisma.EmailConfigCreateInput,
    update: Prisma.EmailConfigUpdateInput,
  ): Promise<EmailConfig> {
    const existing = await this.getConfig();
    if (existing) {
      return this.prisma.emailConfig.update({
        where: { id: existing.id },
        data: update,
      });
    }
    return this.prisma.emailConfig.create({ data });
  }

  create(data: Prisma.EmailConfigCreateInput): Promise<EmailConfig> {
    return this.prisma.emailConfig.create({ data });
  }

  async update(data: Prisma.EmailConfigUpdateInput): Promise<EmailConfig | null> {
    const existing = await this.getConfig();
    if (!existing) return null;
    return this.prisma.emailConfig.update({
      where: { id: existing.id },
      data,
    });
  }
}
