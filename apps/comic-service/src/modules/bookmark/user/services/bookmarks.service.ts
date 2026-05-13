import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrimaryKey } from 'src/types';
import { I18nService } from 'nestjs-i18n';
import { CreateBookmarkDto } from '../dtos/create-bookmark.dto';
import { t, createPaginationMeta, parseQueryOptions } from '@package/common';
import { BookmarkFilter, BookmarkRepository } from '../../repositories/bookmark.repository';

@Injectable()
export class UserBookmarkService {
  constructor(
    private readonly bookmarkRepo: BookmarkRepository,
    private readonly i18n: I18nService,
  ) {}

  async getList(userId: PrimaryKey, query: any = {}) {
    const options = parseQueryOptions(query);

    const filter: BookmarkFilter = { userId: userId };
    if (query.chapterId) filter.chapterId = query.chapterId;

    const [data, total] = await Promise.all([
      this.bookmarkRepo.findMany(filter, options),
      this.bookmarkRepo.count(filter),
    ]);

    return { data, meta: createPaginationMeta(options, total) };
  }

  async create(userId: PrimaryKey, dto: CreateBookmarkDto) {
    // Upsert — double-tap is idempotent now that Bookmark has a unique
    // constraint on (user_id, chapter_id, page_number).
    return this.bookmarkRepo.upsert({
      userId: userId,
      chapterId: dto.chapterId,
      pageNumber: dto.pageNumber,
    });
  }

  async delete(userId: PrimaryKey, id: PrimaryKey) {
    const bookmark = await this.bookmarkRepo.findById(id);
    if (!bookmark) throw new NotFoundException(t(this.i18n, 'comic.BOOKMARK_NOT_FOUND'));
    if (String(bookmark.userId) !== String(userId)) throw new ForbiddenException(t(this.i18n, 'comic.FORBIDDEN'));
    await this.bookmarkRepo.delete(id);
    return { success: true };
  }
}
