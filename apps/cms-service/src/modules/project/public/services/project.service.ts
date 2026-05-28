import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { createPaginationMeta, parseQueryOptions } from '@package/common';
import { RedisService } from '@package/redis';
import { ProjectFilter, ProjectRepository } from '../../repositories/project.repository';
import { ProjectStatus } from '../../enums/project-status.enum';

const PUBLIC_PROJECT_STATUSES = [ProjectStatus.planning, ProjectStatus.in_progress, ProjectStatus.completed];

@Injectable()
export class PublicProjectService {
  private readonly inflight = new Map<string, Promise<any>>();

  constructor(
    private readonly projectRepo: ProjectRepository,
    @Optional() private readonly redis?: RedisService,
  ) {}

  private async getOrSet<T>(key: string, ttl: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.redis?.get(key).catch(() => null);
    if (cached) return JSON.parse(cached);
    const existing = this.inflight.get(key);
    if (existing) return existing;
    const promise = loader().then(async (result) => {
      this.inflight.delete(key);
      await this.redis?.set(key, JSON.stringify(result), ttl).catch(() => {});
      return result;
    }).catch((err) => {
      this.inflight.delete(key);
      throw err;
    });
    this.inflight.set(key, promise);
    return promise;
  }

  async getList(query: any = {}) {
    const options = parseQueryOptions(query);

    const filter: ProjectFilter = { status: PUBLIC_PROJECT_STATUSES };
    if (query.search) filter.search = query.search;
    if (query.featured !== undefined) {
      filter.featured = query.featured === 'true' || query.featured === true;
    }

    return this.getOrSet('introduction:public:project:list', 300, async () => {
      const [data, total] = await Promise.all([
        this.projectRepo.findManyPublic(filter, options),
        this.projectRepo.count(filter),
      ]);
      return { data, meta: createPaginationMeta(options, total) };
    });
  }

  getOptions() {
    return this.projectRepo.findOptions();
  }

  async getBySlug(slug: string) {
    return this.getOrSet(`introduction:public:project:detail:${slug}`, 600, async () => {
      const item = await this.projectRepo.findPublicBySlug(slug, PUBLIC_PROJECT_STATUSES);
      if (!item) throw new NotFoundException('Project not found');

      await this.projectRepo.incrementViewCount(item.id);

      return { ...item, viewCount: item.viewCount + 1 };
    });
  }
}
