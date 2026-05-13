import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { PrimaryKey } from 'src/types';
import { CreateGalleryDto } from '../dtos/create-gallery.dto';
import { UpdateGalleryDto } from '../dtos/update-gallery.dto';
import { SlugHelper, createPaginationMeta, parseQueryOptions } from '@package/common';
import { RedisService } from '@package/redis';
import { GalleryFilter, GalleryRepository } from '../../repositories/gallery.repository';

@Injectable()
export class AdminGalleryService {
  constructor(
    private readonly galleryRepo: GalleryRepository,
    @Optional() private readonly redis?: RedisService,
  ) {}

  private async clearCache(slug?: string) {
    await this.redis?.del('introduction:public:gallery:list').catch(() => {});
    if (slug) {
      await this.redis?.del(`introduction:public:gallery:detail:${slug}`).catch(() => {});
    }
  }

  private mapP2002(err: unknown): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new BadRequestException('Slug already in use');
    }
    throw err;
  }

  async getList(query: any = {}) {
    const options = parseQueryOptions(query);

    const filter: GalleryFilter = {};
    if (query.search) filter.search = query.search;
    if (query.status) filter.status = query.status;
    if (query.featured !== undefined) {
      filter.featured = query.featured === 'true' || query.featured === true;
    }

    const skipCount = query.skipCount === true || query.skipCount === 'true';
    const [data, total] = await Promise.all([
      this.galleryRepo.findMany(filter, options),
      skipCount ? Promise.resolve(0) : this.galleryRepo.count(filter),
    ]);

    return { data, meta: createPaginationMeta(options, total) };
  }

  async getOne(id: PrimaryKey) {
    const item = await this.galleryRepo.findById(id);
    if (!item) throw new NotFoundException('Gallery not found');
    return item;
  }

  async create(dto: CreateGalleryDto) {
    const slug = await SlugHelper.uniqueSlug(dto.slug || dto.title, {
      findOne: (filter: any) => this.galleryRepo.findBySlug(filter.slug),
    });
    try {
      const result = await this.galleryRepo.create({
        title: dto.title,
        slug,
        description: dto.description,
        coverImage: dto.coverImage,
        images: dto.images ?? [],
        featured: dto.featured,
        status: dto.status,
        sortOrder: dto.sortOrder,
      });
      await this.clearCache();
      return result;
    } catch (err) {
      this.mapP2002(err);
    }
  }

  async update(id: PrimaryKey, dto: UpdateGalleryDto) {
    const current = await this.getOne(id);

    const data: Record<string, any> = {
      title: dto.title,
      description: dto.description,
      coverImage: dto.coverImage,
      images: dto.images,
      featured: dto.featured,
      status: dto.status,
      sortOrder: dto.sortOrder,
    };
    const titleChanged = dto.title !== undefined && dto.title !== (current as any).title;
    if (dto.slug || titleChanged) {
      data.slug = await SlugHelper.uniqueSlug(
        dto.slug || dto.title || '',
        { findOne: (filter: any) => this.galleryRepo.findBySlug(filter.slug) },
        id,
      );
    }

    try {
      const result = await this.galleryRepo.update(id, data);
      await this.clearCache((current as any).slug);
      if (data.slug && data.slug !== (current as any).slug) {
        await this.clearCache(data.slug);
      }
      return result;
    } catch (err) {
      this.mapP2002(err);
    }
  }

  async delete(id: PrimaryKey) {
    const item = await this.getOne(id);
    await this.galleryRepo.delete(id);
    await this.clearCache((item as any).slug);
    return { success: true };
  }
}
