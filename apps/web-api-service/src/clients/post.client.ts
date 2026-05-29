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

export interface PostListItem {
  id: string;
  title: string;
  slug: string;
  [key: string]: unknown;
}

@Injectable()
export class PostClient implements OnModuleInit {
  private readonly logger = new Logger(PostClient.name);
  private readonly baseUrl: string;
  private readonly timeout: number;
  private breaker!: CircuitBreakerPolicy;

  private readonly internalSecret: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.get<string>('gateway.postServiceUrl', 'http://localhost:3007/api');
    this.timeout = config.get<number>('gateway.serviceTimeoutMs', 5000);
    this.internalSecret = config.get<string>('gateway.internalApiSecret', '');
  }

  onModuleInit() {
    this.breaker = createCircuitBreaker({ halfOpenAfterMs: 10_000, maxConsecutiveFailures: 5 });
  }

  async getLatestPosts(limit = 6): Promise<PostListItem[]> {
    const url = `${this.baseUrl}/public/posts?limit=${limit}&sort=created_at:DESC`;
    return this.get<PostListItem[]>(url, []);
  }

  async getPosts(params?: { page?: number; limit?: number; tag?: string; category?: string }): Promise<unknown> {
    const url = new URL(`${this.baseUrl}/public/posts`);
    if (params?.page) url.searchParams.set('page', String(params.page));
    if (params?.limit) url.searchParams.set('limit', String(params.limit));
    if (params?.tag) url.searchParams.set('post_tag_id', params.tag);
    if (params?.category) url.searchParams.set('post_category_id', params.category);
    return this.get<unknown>(url.toString(), null);
  }

  async getPost(slug: string): Promise<unknown> {
    return this.get<unknown>(`${this.baseUrl}/public/posts/${slug}`, null);
  }

  async getPostComments(slug: string, params?: { page?: number; limit?: number }): Promise<unknown> {
    // post-service uses post_id, not slug — caller should resolve post first or pass id
    const url = new URL(`${this.baseUrl}/public/post-comments`);
    if (slug) url.searchParams.set('post_slug', slug);
    if (params?.page) url.searchParams.set('page', String(params.page));
    if (params?.limit) url.searchParams.set('limit', String(params.limit));
    return this.get<unknown>(url.toString(), null);
  }

  async getPostCategories(): Promise<unknown[]> {
    return this.get<unknown[]>(`${this.baseUrl}/public/post-categories`, []);
  }

  async getPostTags(): Promise<unknown[]> {
    return this.get<unknown[]>(`${this.baseUrl}/public/post-tags`, []);
  }

  async getFeaturedPosts(limit?: number): Promise<unknown[]> {
    const url = new URL(`${this.baseUrl}/public/posts`);
    url.searchParams.set('is_featured', 'true');
    if (limit) url.searchParams.set('limit', String(limit));
    return this.get<unknown[]>(url.toString(), []);
  }

  async searchPosts(query: string, params?: { page?: number; limit?: number }): Promise<unknown> {
    const url = new URL(`${this.baseUrl}/public/posts`);
    url.searchParams.set('search', query);
    if (params?.page) url.searchParams.set('page', String(params.page));
    if (params?.limit) url.searchParams.set('limit', String(params.limit));
    return this.get<unknown>(url.toString(), null);
  }

  private async get<T>(url: string, fallback: T): Promise<T> {
    try {
      return await this.breaker.execute(() => this.doGet<T>(url, fallback));
    } catch (err: any) {
      this.logger.warn(`PostClient circuit open for ${url}: ${(err as Error).message}`);
      return fallback;
    }
  }

  private async doGet<T>(url: string, fallback: T): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (this.internalSecret) headers['x-internal-secret'] = this.internalSecret;

      const res = await fetch(url, {
        signal: controller.signal,
        headers,
        dispatcher: keepAliveAgent,
      } as any);

      if (!res.ok) {
        this.logger.warn(`PostClient GET ${url} → ${res.status}`);
        return fallback;
      }

      const data = (await res.json()) as { data?: T } | T;
      return (data as any)?.data ?? (data as T);
    } catch (err: any) {
      this.logger.warn(`PostClient GET ${url} failed: ${(err as Error).message}`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
