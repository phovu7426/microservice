import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCircuitBreaker } from '@package/circuit-breaker';
import type { CircuitBreakerPolicy } from 'cockatiel';
import { Agent } from 'undici';

const keepAliveAgent = new Agent({
  connections: 10,
  keepAliveTimeout: 30_000,
  pipelining: 1,
});

export interface ComicListItem {
  id: string;
  title: string;
  slug: string;
  thumbnail?: string;
  view_count?: number;
  follow_count?: number;
  [key: string]: unknown;
}

export interface ComicCategory {
  id: string;
  name: string;
  slug: string;
  [key: string]: unknown;
}

@Injectable()
export class ComicClient implements OnModuleInit {
  private readonly logger = new Logger(ComicClient.name);
  private readonly baseUrl: string;
  private readonly timeout: number;
  private breaker!: CircuitBreakerPolicy;

  private readonly internalSecret: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.get<string>('gateway.comicServiceUrl', 'http://localhost:3001/api');
    this.timeout = config.get<number>('gateway.serviceTimeoutMs', 5000);
    this.internalSecret = config.get<string>('gateway.internalApiSecret', '');
  }

  onModuleInit() {
    this.breaker = createCircuitBreaker({ halfOpenAfterMs: 10_000, maxConsecutiveFailures: 5 });
  }

  async getComics(params: { limit?: number; sort?: string }): Promise<ComicListItem[]> {
    const url = new URL(`${this.baseUrl}/public/comics`);
    if (params.limit) url.searchParams.set('limit', String(params.limit));
    if (params.sort) url.searchParams.set('sort', params.sort);
    return this.get<ComicListItem[]>(url.toString(), []);
  }

  async getRecentlyUpdated(limit = 8): Promise<unknown[]> {
    const url = new URL(`${this.baseUrl}/public/homepage/recently-updated`);
    url.searchParams.set('limit', String(limit));
    return this.get<unknown[]>(url.toString(), []);
  }

  async getTopViewed(limit = 8): Promise<unknown[]> {
    const url = new URL(`${this.baseUrl}/public/homepage/top-viewed`);
    url.searchParams.set('limit', String(limit));
    return this.get<unknown[]>(url.toString(), []);
  }

  async getPopular(limit = 8): Promise<unknown[]> {
    const url = new URL(`${this.baseUrl}/public/homepage/popular`);
    url.searchParams.set('limit', String(limit));
    return this.get<unknown[]>(url.toString(), []);
  }

  async getNewest(limit = 8): Promise<unknown[]> {
    const url = new URL(`${this.baseUrl}/public/homepage/newest`);
    url.searchParams.set('limit', String(limit));
    return this.get<unknown[]>(url.toString(), []);
  }

  async getCategories(): Promise<ComicCategory[]> {
    return this.get<ComicCategory[]>(`${this.baseUrl}/public/homepage/categories`, []);
  }

  async getComic(slug: string): Promise<unknown> {
    return this.get<unknown>(`${this.baseUrl}/public/comics/${slug}`, null);
  }

  async getComicChapters(slug: string, params?: { page?: number; limit?: number }): Promise<unknown> {
    const url = new URL(`${this.baseUrl}/public/comics/${slug}/chapters`);
    if (params?.page) url.searchParams.set('page', String(params.page));
    if (params?.limit) url.searchParams.set('limit', String(params.limit));
    return this.get<unknown>(url.toString(), null);
  }

  async getChapter(chapterId: string): Promise<unknown> {
    return this.get<unknown>(`${this.baseUrl}/public/chapters/${chapterId}`, null);
  }

  async getChapterPages(chapterId: string): Promise<unknown> {
    return this.get<unknown>(`${this.baseUrl}/public/chapters/${chapterId}/pages`, null);
  }

  async getComicComments(comicId: string, params?: { page?: number; limit?: number }): Promise<unknown> {
    const url = new URL(`${this.baseUrl}/public/comments`);
    url.searchParams.set('comic_id', comicId);
    if (params?.page) url.searchParams.set('page', String(params.page));
    if (params?.limit) url.searchParams.set('limit', String(params.limit));
    return this.get<unknown>(url.toString(), null);
  }

  async getComicReviews(comicId: string, params?: { page?: number; limit?: number }): Promise<unknown> {
    const url = new URL(`${this.baseUrl}/public/reviews`);
    url.searchParams.set('comic_id', comicId);
    if (params?.page) url.searchParams.set('page', String(params.page));
    if (params?.limit) url.searchParams.set('limit', String(params.limit));
    return this.get<unknown>(url.toString(), null);
  }

  async searchComics(query: string, params?: { page?: number; limit?: number; category?: string }): Promise<unknown> {
    const url = new URL(`${this.baseUrl}/public/comics`);
    url.searchParams.set('search', query);
    if (params?.page) url.searchParams.set('page', String(params.page));
    if (params?.limit) url.searchParams.set('limit', String(params.limit));
    if (params?.category) url.searchParams.set('comic_category_id', params.category);
    return this.get<unknown>(url.toString(), null);
  }

  async getComicsByCategory(categoryId: string, params?: { page?: number; limit?: number; sort?: string }): Promise<unknown> {
    const url = new URL(`${this.baseUrl}/public/comics`);
    if (categoryId) url.searchParams.set('comic_category_id', categoryId);
    if (params?.page) url.searchParams.set('page', String(params.page));
    if (params?.limit) url.searchParams.set('limit', String(params.limit));
    if (params?.sort) url.searchParams.set('sort', params.sort);
    return this.get<unknown>(url.toString(), null);
  }

  private async get<T>(url: string, fallback: T): Promise<T> {
    try {
      return await this.breaker.execute(() => this.doGet<T>(url, fallback));
    } catch (err: any) {
      this.logger.warn(`ComicClient circuit open for ${url}: ${(err as Error).message}`);
      return fallback;
    }
  }

  private async doGet<T>(url: string, fallback: T): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      // Server-side internal secret only — never forward client-supplied
      // `x-internal-secret` headers.
      if (this.internalSecret) headers['x-internal-secret'] = this.internalSecret;

      const res = await fetch(url, {
        signal: controller.signal,
        headers,
        dispatcher: keepAliveAgent,
      } as any);

      if (!res.ok) {
        this.logger.warn(`ComicClient GET ${url} → ${res.status}`);
        return fallback;
      }

      const data = (await res.json()) as { data?: T } | T;
      return (data as any)?.data ?? (data as T);
    } catch (err: any) {
      this.logger.warn(`ComicClient GET ${url} failed: ${(err as Error).message}`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
