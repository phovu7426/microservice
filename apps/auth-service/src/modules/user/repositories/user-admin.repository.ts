import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { PrismaService } from '../../../core/database/prisma.service';
import { PrimaryKey, toPrimaryKey } from 'src/types';
import { parseQueryOptions, createPaginationMeta } from '@package/common';

type Tx = Prisma.TransactionClient | PrismaService;

const LIST_SELECT = {
  id: true,
  username: true,
  email: true,
  phone: true,
  name: true,
  image: true,
  status: true,
  created_at: true,
  last_login_at: true,
} satisfies Prisma.UserSelect;

const DETAIL_SELECT = {
  id: true,
  username: true,
  email: true,
  phone: true,
  name: true,
  image: true,
  googleId: true,
  status: true,
  email_verified_at: true,
  phone_verified_at: true,
  last_login_at: true,
  created_user_id: true,
  updated_user_id: true,
  created_at: true,
  updated_at: true,
  profile: true,
} satisfies Prisma.UserSelect;

const SIMPLE_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
  status: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UserAdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: Record<string, any>) {
    const options = parseQueryOptions(query);
    const where = this.buildWhere(query);
    const orderBy = this.buildOrderBy(query.sort);

    const skipCount = query.skipCount === 'true';

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: LIST_SELECT,
        skip: options.skip,
        take: options.take,
        orderBy,
      }),
      skipCount ? Promise.resolve(0) : this.prisma.user.count({ where }),
    ]);

    const meta = createPaginationMeta(options, total);
    return { data, meta };
  }

  async findAllSimple(query: Record<string, any>) {
    const where = this.buildWhere(query);

    const data = await this.prisma.user.findMany({
      where,
      select: SIMPLE_SELECT,
      take: 200,
      orderBy: { id: 'desc' },
    });

    return { data };
  }

  findById(id: PrimaryKey) {
    return this.prisma.user.findUnique({
      where: { id },
      select: DETAIL_SELECT,
    });
  }

  findByIdWithPassword(id: PrimaryKey) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, password: true },
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  findByPhone(phone: string) {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  async withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  create(data: Record<string, any>, tx: Tx = this.prisma) {
    return tx.user.create({ data: data as Prisma.UserCreateInput });
  }

  update(id: PrimaryKey, data: Record<string, any>, tx: Tx = this.prisma) {
    return tx.user.update({ where: { id }, data: data as Prisma.UserUpdateInput });
  }

  async createWithProfile(
    userData: Record<string, any>,
    profileData?: Record<string, any>,
  ) {
    return this.withTransaction(async (tx) => {
      const user = await this.create(userData, tx);
      if (profileData) {
        await this.upsertProfile(user.id, profileData, tx);
      }
      return user;
    });
  }

  async updateWithProfile(
    id: PrimaryKey,
    userData?: Record<string, any>,
    profileData?: Record<string, any>,
  ) {
    return this.withTransaction(async (tx) => {
      if (userData && Object.keys(userData).length > 0) {
        await this.update(id, userData, tx);
      }
      if (profileData && Object.keys(profileData).length > 0) {
        await this.upsertProfile(id, profileData, tx);
      }
    });
  }

  delete(id: PrimaryKey) {
    return this.prisma.user.delete({ where: { id } });
  }

  upsertProfile(userId: PrimaryKey, data: Record<string, any>, tx: Tx = this.prisma) {
    const normalized = this.normalizePayload(data);
    return tx.profile.upsert({
      where: { user_id: userId },
      create: { user_id: userId, ...normalized } as Prisma.ProfileUncheckedCreateInput,
      update: normalized as Prisma.ProfileUncheckedUpdateInput,
    });
  }

  async checkUnique(
    fields: { email?: string; username?: string; phone?: string },
    excludeId?: PrimaryKey,
  ): Promise<{ field: string; value: string } | null> {
    const conditions: Prisma.UserWhereInput[] = [];

    if (fields.email) conditions.push({ email: fields.email });
    if (fields.username) conditions.push({ username: fields.username });
    if (fields.phone) conditions.push({ phone: fields.phone });

    if (conditions.length === 0) return null;

    const where: Prisma.UserWhereInput = {
      OR: conditions,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    };

    const existing = await this.prisma.user.findFirst({
      where,
      select: { id: true, email: true, username: true, phone: true },
    });

    if (!existing) return null;

    if (fields.email && existing.email === fields.email) {
      return { field: 'email', value: fields.email };
    }
    if (fields.username && existing.username === fields.username) {
      return { field: 'username', value: fields.username };
    }
    if (fields.phone && existing.phone === fields.phone) {
      return { field: 'phone', value: fields.phone };
    }

    return null;
  }

  private buildWhere(query: Record<string, any>): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};
    const andConditions: Prisma.UserWhereInput[] = [];

    if (query.search) {
      const search = query.search;
      andConditions.push({
        OR: [
          { email: { startsWith: search, mode: 'insensitive' } },
          { username: { startsWith: search, mode: 'insensitive' } },
          { name: { startsWith: search, mode: 'insensitive' } },
          { phone: { startsWith: search } },
        ],
      });
    }

    if (query.status) {
      andConditions.push({ status: query.status });
    }

    if (query.email) {
      andConditions.push({ email: query.email });
    }

    if (query.phone) {
      andConditions.push({ phone: query.phone });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    return where;
  }

  private normalizePayload(data: Record<string, any>): Record<string, any> {
    const result = { ...data };

    // Map camelCase DTO fields → snake_case Prisma fields
    if (result.countryId !== undefined) { result.country_id = result.countryId; delete result.countryId; }
    if (result.provinceId !== undefined) { result.province_id = result.provinceId; delete result.provinceId; }
    if (result.wardId !== undefined) { result.ward_id = result.wardId; delete result.wardId; }

    if (result.birthday) result.birthday = new Date(result.birthday);
    if (result.country_id) result.country_id = toPrimaryKey(result.country_id);
    if (result.province_id) result.province_id = toPrimaryKey(result.province_id);
    if (result.ward_id) result.ward_id = toPrimaryKey(result.ward_id);

    return result;
  }

  private buildOrderBy(sort?: string): Prisma.UserOrderByWithRelationInput {
    if (!sort) return { id: 'desc' };

    const [field, direction] = sort.split(':');
    const allowedFields = ['id', 'email', 'username', 'name', 'status', 'created_at', 'last_login_at'];
    const dir = direction?.toLowerCase() === 'asc' ? 'asc' : 'desc';

    if (allowedFields.includes(field)) {
      return { [field]: dir };
    }

    return { id: 'desc' };
  }
}
