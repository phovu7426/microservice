import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { t, createPaginationMeta, parseQueryOptions } from '@package/common';
import { PrimaryKey } from 'src/types';
import { ContentTemplateRepository, ContentTemplateFilter } from '../../repositories/content-template.repository';
import { CreateContentTemplateDto } from '../dtos/create-content-template.dto';
import { UpdateContentTemplateDto } from '../dtos/update-content-template.dto';
import { ListContentTemplatesAdminQueryDto } from '../dtos/list-content-templates.query.dto';

@Injectable()
export class AdminContentTemplateService {
  constructor(
    private readonly templateRepo: ContentTemplateRepository,
    private readonly i18n: I18nService,
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
    return this.templateRepo.create(dto as any);
  }

  async update(id: PrimaryKey, dto: UpdateContentTemplateDto) {
    await this.getOne(id);
    if (dto.code) {
      const existing = await this.templateRepo.findFirst({ code: dto.code, id: { not: id } });
      if (existing) throw new BadRequestException(t(this.i18n, 'content-template.CODE_EXISTS'));
    }
    return this.templateRepo.update(id, dto as any);
  }

  async delete(id: PrimaryKey) {
    await this.getOne(id);
    await this.templateRepo.delete(id);
    return true;
  }
}
