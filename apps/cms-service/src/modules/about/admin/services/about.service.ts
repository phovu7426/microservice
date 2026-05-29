import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { PrimaryKey } from 'src/types';
import { CreateAboutDto } from '../dtos/create-about.dto';
import { UpdateAboutDto } from '../dtos/update-about.dto';
import { SlugHelper, createPaginationMeta, parseQueryOptions } from '@package/common';
import { RedisService } from '@package/redis';
import { AboutSectionFilter, AboutSectionRepository } from '../../repositories/about-section.repository';

@Injectable()
export class AdminAboutService {
  constructor(
    private readonly aboutRepo: AboutSectionRepository,
    @Optional() private readonly redis?: RedisService,
  ) {}

  private async clearCache(slug?: string) {
    await this.redis?.del('introduction:public:about:list').catch(() => {});
    if (slug) {
      await this.redis?.del(`introduction:public:about:detail:${slug}`).catch(() => {});
    }
  }

  private mapP2002(err: any): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new BadRequestException('Slug already in use');
    }
    throw err;
  }

  async getList(query: any = {}) {
    const options = parseQueryOptions(query);

    const filter: AboutSectionFilter = {};
    if (query.search) filter.search = query.search;
    if (query.status) filter.status = query.status;
    if (query.sectionType) filter.sectionType = query.sectionType;

    const skipCount = query.skipCount === true || query.skipCount === 'true';
    const [data, total] = await Promise.all([
      this.aboutRepo.findMany(filter, options),
      skipCount ? Promise.resolve(0) : this.aboutRepo.count(filter),
    ]);

    return { data, meta: createPaginationMeta(options, total) };
  }

  async getOne(id: PrimaryKey) {
    const item = await this.aboutRepo.findById(id);
    if (!item) throw new NotFoundException('About section not found');
    return item;
  }

  async create(dto: CreateAboutDto) {
    const slug = await SlugHelper.uniqueSlug(dto.slug || dto.title, {
      findOne: (filter: any) => this.aboutRepo.findBySlug(filter.slug),
    });
    try {
      const result = await this.aboutRepo.create({
        title: dto.title,
        slug,
        content: dto.content,
        image: dto.image,
        videoUrl: dto.videoUrl,
        sectionType: dto.sectionType,
        status: dto.status,
        sortOrder: dto.sortOrder,
      });
      await this.clearCache();
      return result;
    } catch (err: any) {
      // Concurrent create raced our slug check.
      this.mapP2002(err);
    }
  }

  async update(id: PrimaryKey, dto: UpdateAboutDto) {
    const current = await this.getOne(id);

    const data: Record<string, any> = {
      title: dto.title,
      content: dto.content,
      image: dto.image,
      videoUrl: dto.videoUrl,
      sectionType: dto.sectionType,
      status: dto.status,
      sortOrder: dto.sortOrder,
    };
    const titleChanged = dto.title !== undefined && dto.title !== (current as any).title;
    if (dto.slug || titleChanged) {
      data.slug = await SlugHelper.uniqueSlug(
        dto.slug || dto.title || '',
        { findOne: (filter: any) => this.aboutRepo.findBySlug(filter.slug) },
        id,
      );
    }

    try {
      const result = await this.aboutRepo.update(id, data);
      await this.clearCache((current as any).slug);
      // If slug changed, also clear the new slug cache
      if (data.slug && data.slug !== (current as any).slug) {
        await this.clearCache(data.slug);
      }
      return result;
    } catch (err: any) {
      this.mapP2002(err);
    }
  }

  async delete(id: PrimaryKey) {
    const item = await this.getOne(id);
    await this.aboutRepo.delete(id);
    await this.clearCache((item as any).slug);
    return { success: true };
  }
}
