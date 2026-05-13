import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { PrismaService } from '../../../core/database/prisma.service';

const HOMEPAGE_COMIC_SELECT = {
  id: true,
  slug: true,
  title: true,
  coverImage: true,
  author: true,
  status: true,
  lastChapterUpdatedAt: true,
  isFeatured: true,
  stats: true,
  categoryLinks: {
    select: { category: { select: { id: true, name: true, slug: true } } },
  },
  chapters: {
    where: { status: 'published' as const },
    orderBy: { chapterIndex: 'desc' as const },
    take: 1,
    select: { id: true, title: true, chapterIndex: true, chapterLabel: true, createdAt: true },
  },
} as const;

@Injectable()
export class HomepageRepository {
  constructor(private readonly prisma: PrismaService) {}

  findComics(statuses: string[], orderBy: Prisma.ComicOrderByWithRelationInput, limit: number) {
    return this.prisma.comic.findMany({
      where: { status: { in: statuses } },
      select: HOMEPAGE_COMIC_SELECT,
      orderBy,
      take: limit,
    });
  }

  findCategories() {
    return this.prisma.category.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
  }
}
