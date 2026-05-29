export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface QueryOptions {
  page: number;
  skip: number;
  take: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

export function createPaginationMeta(options: QueryOptions, total: number): PaginationMeta {
  return {
    page: options.page,
    limit: options.take,
    total,
    totalPages: Math.ceil(total / options.take),
    hasNextPage: options.page * options.take < total,
    hasPreviousPage: options.page > 1,
  };
}

/**
 * Default cap for `take` so a single request can never DoS the DB by
 * issuing `?limit=1000000`. Services that legitimately need a higher cap
 * pass an explicit `maxTake` to {@link parseQueryOptions}.
 */
export const DEFAULT_MAX_TAKE = 100;
export const MAX_PAGE = 1_000;

export function parseQueryOptions(
  query: any,
  options: { maxTake?: number; defaultTake?: number; allowedSortFields?: string[] } = {},
): QueryOptions {
  const maxTake = options.maxTake ?? DEFAULT_MAX_TAKE;
  const defaultTake = options.defaultTake ?? 10;
  const rawPage = Number(query?.page);
  const rawLimit = Number(query?.limit);
  const page = Math.min(
    Math.max(Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1, 1),
    MAX_PAGE,
  );
  const take = Math.min(
    Math.max(Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : defaultTake, 1),
    maxTake,
  );
  const skip = (page - 1) * take;

  // Validate sortBy: only allow safe characters (letters, numbers, underscore, dot)
  const rawSortBy = query?.sort_by;
  let sortBy: string | undefined;
  if (rawSortBy) {
    if (options.allowedSortFields) {
      sortBy = options.allowedSortFields.includes(rawSortBy) ? rawSortBy : undefined;
    } else {
      sortBy = /^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(rawSortBy) ? rawSortBy : undefined;
    }
  }

  const order: 'asc' | 'desc' | undefined =
    query?.order === 'asc' || query?.order === 'desc' ? query.order : undefined;
  return { page, skip, take, sortBy, order };
}

export function toPrimaryKey(value: any): bigint {
  if (typeof value === 'bigint') return value;
  return BigInt(value);
}
