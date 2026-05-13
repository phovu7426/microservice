import { Injectable } from '@nestjs/common';
import { PrimaryKey } from 'src/types';
import { createPaginationMeta, parseQueryOptions } from '@package/common';
import { ReadingHistoryFilter, ReadingHistoryRepository } from '../../repositories/reading-history.repository';

@Injectable()
export class UserReadingHistoryService {
  constructor(private readonly historyRepo: ReadingHistoryRepository) {}

  async getList(userId: PrimaryKey, query: any = {}) {
    const options = parseQueryOptions(query);

    const filter: ReadingHistoryFilter = { userId: userId };

    const [data, total] = await Promise.all([
      this.historyRepo.findMany(filter, options),
      this.historyRepo.count(filter),
    ]);

    return { data, meta: createPaginationMeta(options, total) };
  }

  async upsert(userId: PrimaryKey, comicId: PrimaryKey, chapterId: PrimaryKey) {
    return this.historyRepo.upsert(userId, comicId, chapterId);
  }

  async clear(userId: PrimaryKey, comicId: PrimaryKey) {
    await this.historyRepo.deleteByUserComic({ userId: userId, comicId: comicId });
    return { success: true };
  }
}
