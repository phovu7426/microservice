import { Injectable, NotFoundException } from '@nestjs/common';
import { PrimaryKey } from 'src/types';
import { RedisService } from '@package/redis';
import { I18nService } from 'nestjs-i18n';
import { t } from '@package/common';
import { ChapterRepository } from '../../repositories/chapter.repository';

@Injectable()
export class PublicChapterService {
  private readonly inflight = new Map<string, Promise<any>>();

  constructor(
    private readonly chapterRepo: ChapterRepository,
    private readonly i18n: I18nService,
    private readonly redis: RedisService,
  ) {}

  async getOne(id: PrimaryKey) {
    const cacheKey = `comic:public:chapter:${id}`;

    return this.getOrSet(cacheKey, 120, async () => {
      const chapter = await this.chapterRepo.findPublicOne(id);
      if (!chapter) throw new NotFoundException(t(this.i18n, 'comic.CHAPTER_NOT_FOUND'));
      return chapter;
    });
  }

  async getPages(id: PrimaryKey) {
    const cacheKey = `comic:public:pages:${id}`;

    return this.getOrSet(cacheKey, 300, async () => {
      const chapter = await this.chapterRepo.findPublicOne(id);
      if (!chapter) throw new NotFoundException(t(this.i18n, 'comic.CHAPTER_NOT_FOUND'));

      const pages = await this.chapterRepo.findPages(id);
      return { data: pages };
    });
  }

  async getNext(id: PrimaryKey) {
    const version = await this.getVersion('comic:public:nav:v');
    const cacheKey = `comic:public:chapternav:${version}:${id}:next`;

    return this.getOrSetRaw(cacheKey, 300, async () => {
      const current = await this.chapterRepo.findById(id);
      if (!current) throw new NotFoundException(t(this.i18n, 'comic.CHAPTER_NOT_FOUND'));
      return (await this.chapterRepo.findPublishedNeighbor(current.comicId, current.chapterIndex, 'next')) || null;
    });
  }

  async getPrev(id: PrimaryKey) {
    const version = await this.getVersion('comic:public:nav:v');
    const cacheKey = `comic:public:chapternav:${version}:${id}:prev`;

    return this.getOrSetRaw(cacheKey, 300, async () => {
      const current = await this.chapterRepo.findById(id);
      if (!current) throw new NotFoundException(t(this.i18n, 'comic.CHAPTER_NOT_FOUND'));
      return (await this.chapterRepo.findPublishedNeighbor(current.comicId, current.chapterIndex, 'prev')) || null;
    });
  }

  private async getVersion(key: string): Promise<string> {
    try {
      if (this.redis.isEnabled()) {
        return (await this.redis.get(key)) || '0';
      }
    } catch {}
    return '0';
  }

  /**
   * Standard getOrSet: cache miss returns null (not distinguishable from "no data").
   */
  private async getOrSet<T>(key: string, ttl: number, factory: () => Promise<T>): Promise<T> {
    try {
      if (this.redis.isEnabled()) {
        const raw = await this.redis.get(key);
        if (raw) return JSON.parse(raw);
      }
    } catch {}

    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = factory().then(async (result) => {
      try {
        if (this.redis.isEnabled()) {
          await this.redis.set(
            key,
            JSON.stringify(result, (_, v) => (typeof v === 'bigint' ? Number(v) : v)),
            ttl,
          );
        }
      } catch {}
      return result;
    }).finally(() => {
      this.inflight.delete(key);
    });

    this.inflight.set(key, promise);
    return promise;
  }

  /**
   * Raw variant: distinguishes "cached null" from "cache miss" so that
   * navigation endpoints can cache a null result (no next/prev chapter).
   */
  private async getOrSetRaw<T>(key: string, ttl: number, factory: () => Promise<T>): Promise<T> {
    try {
      if (this.redis.isEnabled()) {
        const raw = await this.redis.get(key);
        if (raw !== null) return JSON.parse(raw);
      }
    } catch {}

    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = factory().then(async (result) => {
      try {
        if (this.redis.isEnabled()) {
          await this.redis.set(
            key,
            JSON.stringify(result, (_, v) => (typeof v === 'bigint' ? Number(v) : v)),
            ttl,
          );
        }
      } catch {}
      return result;
    }).finally(() => {
      this.inflight.delete(key);
    });

    this.inflight.set(key, promise);
    return promise;
  }
}
