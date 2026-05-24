import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { t, createPaginationMeta, parseQueryOptions } from '@package/common';
import { PrimaryKey } from 'src/types';
import { ContentTemplateRepository, ContentTemplateFilter } from '../../repositories/content-template.repository';
import { CreateContentTemplateDto } from '../dtos/create-content-template.dto';
import { UpdateContentTemplateDto } from '../dtos/update-content-template.dto';
import { TestContentTemplateDto } from '../dtos/test-content-template.dto';
import { ListContentTemplatesAdminQueryDto } from '../dtos/list-content-templates.query.dto';
import { MailService } from '../../../mail/services/mail.service';

const VAR_PATTERN = /\{\{\s*([\w.]{1,80})\s*\}\}/g;

@Injectable()
export class AdminContentTemplateService {
  constructor(
    private readonly templateRepo: ContentTemplateRepository,
    private readonly i18n: I18nService,
    private readonly mailService: MailService,
  ) {}

  async getList(query: ListContentTemplatesAdminQueryDto) {
    const options = parseQueryOptions(query);

    const filter: ContentTemplateFilter = {};
    if (query.search) filter.search = query.search;
    if (query.type) filter.type = query.type;
    if (query.category) filter.category = query.category;
    if (query.status) filter.status = query.status;

    const skipCount = query.skipCount === 'true';
    const [data, total] = await Promise.all([
      this.templateRepo.findMany(filter, options),
      skipCount ? Promise.resolve(0) : this.templateRepo.count(filter),
    ]);

    return { data, meta: createPaginationMeta(options, total) };
  }

  async getOne(id: PrimaryKey) {
    const template = await this.templateRepo.findById(id);
    if (!template) throw new NotFoundException(t(this.i18n, 'content-template.NOT_FOUND'));
    return template;
  }

  async create(dto: CreateContentTemplateDto) {
    const existing = await this.templateRepo.findByCode(dto.code);
    if (existing) throw new BadRequestException(t(this.i18n, 'content-template.CODE_EXISTS'));
    return this.templateRepo.create({
      code: dto.code,
      name: dto.name,
      category: dto.category,
      type: dto.type,
      content: dto.content,
      filePath: dto.filePath,
      metadata: dto.metadata,
      variables: dto.variables,
      status: dto.status,
    } as any);
  }

  async update(id: PrimaryKey, dto: UpdateContentTemplateDto) {
    await this.getOne(id);
    if (dto.code) {
      const existing = await this.templateRepo.findFirst({ code: dto.code, id: { not: id } });
      if (existing) throw new BadRequestException(t(this.i18n, 'content-template.CODE_EXISTS'));
    }
    return this.templateRepo.update(id, {
      code: dto.code,
      name: dto.name,
      category: dto.category,
      type: dto.type,
      content: dto.content,
      filePath: dto.filePath,
      metadata: dto.metadata,
      variables: dto.variables,
      status: dto.status,
    } as any);
  }

  async delete(id: PrimaryKey) {
    await this.getOne(id);
    await this.templateRepo.delete(id);
    return true;
  }

  async test(id: PrimaryKey, dto: TestContentTemplateDto) {
    const template = await this.getOne(id);
    if (!template.content) throw new BadRequestException(t(this.i18n, 'content-template.NO_CONTENT'));
    const metadata = template.metadata as any;
    const subject = `[TEST] ${metadata?.subject ?? template.name}`;
    await this.mailService.send({
      to: dto.to,
      subject,
      html: this.renderContent(template.content, dto.variables ?? {}),
    });
    return true;
  }

  private renderContent(content: string, variables: Record<string, any>): string {
    return content.replace(VAR_PATTERN, (match, key: string) => {
      const parts = key.split('.');
      let value: any = variables;
      for (const part of parts) {
        if (value == null) return match;
        value = value[part];
      }
      if (value == null) return match;
      return String(value).slice(0, 5000);
    });
  }
}
