import { Injectable, Logger, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@package/redis';
import { I18nService } from 'nestjs-i18n';
import { CreateChapterDto } from '../dtos/create-chapter.dto';
import { UpdateChapterDto } from '../dtos/update-chapter.dto';
import { t, createPaginationMeta, parseQueryOptions } from '@package/common';
import { PrimaryKey, toPrimaryKey } from 'src/types';
import { ChapterFilter, ChapterRepository } from '../../repositories/chapter.repository';

@Injectable()
export class AdminChapterService {
  private readonly logger = new Logger(AdminChapterService.name);

  constructor(
    private readonly chapterRepo: ChapterRepository,
    private readonly i18n: I18nService,
    private readonly config: ConfigService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  async getList(query: any = {}) {
    const options = parseQueryOptions(query);

    const filter: ChapterFilter = {};
    if (query.comicId) filter.comicId = query.comicId;
    if (query.status) filter.status = query.status;
    if (query.teamId) filter.teamId = query.teamId;

    const skipCount = query.skipCount === true || query.skipCount === 'true';
    const [data, total] = await Promise.all([
      this.chapterRepo.findMany(filter, options),
      skipCount ? Promise.resolve(0) : this.chapterRepo.count(filter),
    ]);

    return { data, meta: createPaginationMeta(options, total) };
  }

  async getSimpleList(query: any = {}) {
    const filter: ChapterFilter = {};
    if (query.comicId) filter.comicId = query.comicId;

    const data = await this.chapterRepo.findSimpleMany(filter, 100);
    return { data };
  }

  async getOne(id: PrimaryKey) {
    const chapter = await this.chapterRepo.findById(id);
    if (!chapter) throw new NotFoundException(t(this.i18n, 'comic.CHAPTER_NOT_FOUND'));
    return chapter;
  }

  async create(dto: CreateChapterDto, actorId?: PrimaryKey) {
    const existing = await this.chapterRepo.findByIndex(dto.comicId, dto.chapterIndex);
    if (existing) throw new BadRequestException(t(this.i18n, 'comic.CHAPTER_INDEX_EXISTS'));

    const chapter = await this.chapterRepo.create({
      comicId: dto.comicId,
      teamId: dto.teamId ?? null,
      title: dto.title,
      chapterIndex: dto.chapterIndex,
      chapterLabel: dto.chapterLabel,
      status: dto.status || 'draft',
      createdUserId: actorId,
      updatedUserId: actorId,
    });

    if (dto.pages?.length) {
      await this.chapterRepo.createPages(
        dto.pages.map((p, i) => ({
          chapterId: chapter.id,
          pageNumber: i + 1,
          imageUrl: p.imageUrl,
          width: p.width,
          height: p.height,
          fileSize: p.fileSize ? BigInt(p.fileSize) : null,
        })),
      );
    }

    if (chapter.status === 'published') {
      await this.handlePublish(chapter);
    }

    await this.clearChapterCaches(chapter.id, dto.comicId);
    return this.getOne(chapter.id);
  }

  async update(id: PrimaryKey, dto: UpdateChapterDto, actorId?: PrimaryKey) {
    const existing = await this.getOne(id);

    const data: Record<string, any> = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.chapterIndex !== undefined) data.chapterIndex = dto.chapterIndex;
    if (dto.chapterLabel !== undefined) data.chapterLabel = dto.chapterLabel;
    if (dto.status !== undefined) data.status = dto.status;
    if (actorId) data.updatedUserId = actorId;

    const chapter = await this.chapterRepo.update(id, data);

    if (dto.pages !== undefined) {
      await this.chapterRepo.deletePages(id);
      if (dto.pages.length) {
        await this.chapterRepo.createPages(
          dto.pages.map((p, i) => ({
            chapterId: toPrimaryKey(id),
            pageNumber: i + 1,
            imageUrl: p.imageUrl,
            width: p.width,
            height: p.height,
            fileSize: p.fileSize ? BigInt(p.fileSize) : null,
          })),
        );
      }
    }

    if (dto.status === 'published' && existing.status !== 'published') {
      await this.handlePublish(chapter);
    }

    await this.clearChapterCaches(id, existing.comicId);
    return this.getOne(id);
  }

  async delete(id: PrimaryKey) {
    const chapter = await this.getOne(id);
    await this.chapterRepo.delete(id);
    await this.clearChapterCaches(id, chapter.comicId);
    return { success: true };
  }

  private async clearChapterCaches(chapterId: any, comicId?: any): Promise<void> {
    try {
      await this.redis?.del(`comic:public:chapter:${chapterId}`);
      await this.redis?.del(`comic:public:pages:${chapterId}`);
      // Increment version keys so all old cache keys become stale.
      // Old keys expire naturally via their TTL (60-300s). No SCAN needed.
      await this.redis?.incr('comic:public:chapters:v');
      await this.redis?.incr('comic:public:nav:v');
    } catch (err) {
      this.logger.warn('Failed to clear chapter caches', (err as Error).message);
    }
  }

  private async handlePublish(chapter: any) {
    const kafkaEnabled = !!this.config.get<boolean>('kafka.enabled');

    await this.chapterRepo.withTransaction(async (tx) => {
      await this.chapterRepo.updateComicLastChapterIfLatest(
        chapter.comicId,
        chapter.id,
        chapter.chapterIndex,
        tx,
      );

      if (!kafkaEnabled) return;

      const comic = await this.chapterRepo.findComicBasic(chapter.comicId, tx);
      if (!comic) return;

      await this.chapterRepo.createOutbox(
        'comic.chapter.published',
        {
          comic_id: String(comic.id),
          comic_title: comic.title,
          comic_slug: comic.slug,
          chapter_id: String(chapter.id),
          chapter_index: chapter.chapterIndex,
          chapter_label: chapter.chapterLabel || `Chapter ${chapter.chapterIndex}`,
          published_at: new Date().toISOString(),
        },
        tx,
      );
    });
  }
}
