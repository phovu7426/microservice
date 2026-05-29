import { toPrimaryKey, createPaginationMeta } from '../helpers/pagination.helper';

export interface PrismaDelegate {
  findMany: (args: any) => Promise<any[]>;
  findFirst: (args: any) => Promise<any | null>;
  findUnique?: (args: any) => Promise<any | null>;
  count: (args: any) => Promise<number>;
  create: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
  updateMany: (args: any) => Promise<{ count: number }>;
  upsert: (args: any) => Promise<any>;
  delete: (args: any) => Promise<any>;
  deleteMany: (args: any) => Promise<{ count: number }>;
}

export interface IPaginatedResult<T> {
  data: T[];
  meta: any;
}

export interface IPaginationOptions {
  page?: number;
  limit?: number;
  sort?: string;
  format?: string;
  select?: any;
  include?: any;
  filter?: Record<string, any>;
  skipCount?: boolean;
  maxLimit?: number;
}

function parseSort(sortStr: string): Record<string, 'asc' | 'desc'>[] {
  if (!sortStr) return [];
  return sortStr.split(',').map((s) => {
    const [field, dir] = s.trim().split(':');
    return { [field]: dir?.toLowerCase() === 'asc' ? 'asc' : 'desc' } as any;
  });
}

function resolveQuerySelection(
  options: { select?: any; include?: any },
  defaults: { select?: any; include?: any },
): { select?: any; include?: any } {
  if (options.select) return { select: options.select };
  if (options.include) return { include: options.include };
  if (defaults.select) return { select: defaults.select };
  if (defaults.include) return { include: defaults.include };
  return {};
}

export function prepareQuery(query: any = {}): { filter: any; options: IPaginationOptions } {
  if (!query || typeof query !== 'object') {
    return { filter: {}, options: {} };
  }

  const {
    page, limit, sort, sort_by, sort_order, sortBy, sortOrder,
    format, filters, filter: nestedFilter, options,
    maxLimit, skipCount,
    ...flatFilters
  } = query;

  const rootOptions: any = {};
  if (page !== undefined) rootOptions.page = Number(page);
  if (limit !== undefined) rootOptions.limit = Number(limit);
  if (sort !== undefined) rootOptions.sort = sort;
  if (format !== undefined) rootOptions.format = format;
  if (maxLimit !== undefined) rootOptions.maxLimit = Number(maxLimit);
  if (skipCount !== undefined) rootOptions.skipCount = skipCount === 'true' || skipCount === true;

  const finalSortBy = sort_by || sortBy;
  const finalSortOrder = sort_order || sortOrder || 'DESC';
  if (finalSortBy && !sort) {
    rootOptions.sort = `${finalSortBy}:${finalSortOrder.toUpperCase()}`;
  }

  return {
    filter: { ...flatFilters, ...(filters || {}), ...(nestedFilter || {}) },
    options: { ...rootOptions, ...(options || {}) },
  };
}


export abstract class PrismaRepository<
  Model,
  WhereInput = any,
  _CreateInput = any,
  _UpdateInput = any,
  OrderByInput = any,
> {
  protected isSoftDelete = false;
  protected skipCountByDefault = false;
  protected defaultSelect: any = undefined;
  protected defaultInclude: any = undefined;
  protected defaultDetailSelect: any = undefined;
  protected defaultDetailInclude: any = undefined;

  constructor(
    protected readonly delegate: PrismaDelegate,
    protected readonly defaultSort: string = 'created_at:desc',
  ) {}

  protected abstract buildWhere(filter: Record<string, any>): WhereInput;

  async findAll(query: Record<string, any> = {}): Promise<IPaginatedResult<Model>> {
    const { filter, options } = prepareQuery(query);
    const page = Math.max(Number(options.page) || 1, 1);
    const limit = Math.max(Number(options.limit) || 10, 1);
    const sort = options.sort || this.defaultSort;

    const where: any = this.buildWhere(filter);
    const orderBy = parseSort(sort) as unknown as OrderByInput[];

    const selectionFlat = resolveQuerySelection(options, {
      select: this.defaultSelect,
      include: this.defaultInclude,
    });

    const skipCount = (query.skipCount === 'true' || query.skipCount === true) ?? this.skipCountByDefault;

    const [data, total] = await Promise.all([
      this.delegate.findMany({
        where, orderBy, skip: (page - 1) * limit, take: limit, ...selectionFlat,
      }),
      skipCount ? Promise.resolve(0) : this.delegate.count({ where }),
    ]);

    return { data, meta: createPaginationMeta({ page, skip: (page - 1) * limit, take: limit }, total) };
  }

  async findById(id: any): Promise<Model | null> {
    const selection = resolveQuerySelection({}, {
      select: this.defaultDetailSelect ?? this.defaultSelect,
      include: this.defaultDetailInclude ?? this.defaultInclude,
    });
    const finder = this.delegate.findUnique || this.delegate.findFirst;
    const result = await finder({ where: { id: toPrimaryKey(id) } as any, ...selection });
    return result;
  }

  async findManyByIds(ids: any[]): Promise<Model[]> {
    if (!ids?.length) return [];
    const selection = resolveQuerySelection({}, {
      select: this.defaultDetailSelect ?? this.defaultSelect,
      include: this.defaultDetailInclude ?? this.defaultInclude,
    });
    const result = await this.delegate.findMany({
      where: { id: { in: ids.map(toPrimaryKey) } } as any, ...selection,
    });
    return result;
  }

  async findOne(filter: Record<string, any>): Promise<Model | null> {
    const selection = resolveQuerySelection({}, {
      select: this.defaultDetailSelect ?? this.defaultSelect,
      include: this.defaultDetailInclude ?? this.defaultInclude,
    });
    const result = await this.delegate.findFirst({ where: this.buildWhere(filter), ...selection });
    return result;
  }

  async findMany(filter: Record<string, any> = {}, options: Record<string, any> = {}): Promise<Model[]> {
    const selectionFlat = resolveQuerySelection(options, {
      select: this.defaultSelect, include: this.defaultInclude,
    });
    const result = await this.delegate.findMany({
      where: this.buildWhere(filter),
      orderBy: options.sort ? parseSort(options.sort) : undefined,
      take: options.limit ? Number(options.limit) : undefined,
      skip: options.page && options.limit ? (Number(options.page) - 1) * Number(options.limit) : undefined,
      ...selectionFlat,
    });
    return result;
  }

  async create(data: any): Promise<Model> {
    const result = await this.delegate.create({ data });
    return result;
  }

  async update(id: any, data: any): Promise<Model> {
    const result = await this.delegate.update({ where: { id: toPrimaryKey(id) } as any, data });
    return result;
  }

  async updateMany(filter: Record<string, any>, data: any): Promise<{ count: number }> {
    return this.delegate.updateMany({ where: this.buildWhere(filter), data });
  }

  async upsert(id: any, data: any): Promise<Model> {
    const pk = toPrimaryKey(id);
    const result = await this.delegate.upsert({
      where: { id: pk } as any,
      create: { ...data, id: pk },
      update: data,
    });
    return result;
  }

  async delete(id: any): Promise<boolean> {
    try {
      await this.delegate.delete({ where: { id: toPrimaryKey(id) } as any });
      return true;
    } catch (error: any) {
      if (error?.code === 'P2025') return false;
      throw error;
    }
  }

  async deleteMany(filter: Record<string, any>): Promise<{ count: number }> {
    return this.delegate.deleteMany({ where: this.buildWhere(filter) });
  }

  async exists(filter: Record<string, any>): Promise<boolean> {
    const count = await this.delegate.count({ where: this.buildWhere(filter) });
    return count > 0;
  }

  async count(filter: Record<string, any> = {}): Promise<number> {
    return this.delegate.count({ where: this.buildWhere(filter) });
  }

  async findFirstRaw(options: any): Promise<Model | null> {
    const result = await this.delegate.findFirst(options);
    return result;
  }

  async findManyRaw(options: any): Promise<Model[]> {
    const result = await this.delegate.findMany(options);
    return result;
  }

  protected toPrimaryKey(id: any): any {
    return toPrimaryKey(id);
  }

  protected parseSort(sortStr: string): OrderByInput[] {
    return parseSort(sortStr) as unknown as OrderByInput[];
  }
}
