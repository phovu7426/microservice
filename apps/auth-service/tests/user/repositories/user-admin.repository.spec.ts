jest.mock('src/generated/prisma', () => ({ Prisma: {} }), { virtual: true });
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));
jest.mock('src/types', () => ({
  toPrimaryKey: (v: any) => BigInt(v),
  PrimaryKey: BigInt,
}), { virtual: true });
jest.mock('@package/common', () => ({
  parseQueryOptions: jest.fn(() => ({ skip: 0, take: 10 })),
  createPaginationMeta: jest.fn((_opts, total) => ({ total })),
}));
jest.mock('../../../src/core/database/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { UserAdminRepository } from '../../../src/modules/user/repositories/user-admin.repository';

function makeRepo() {
  const prisma = {
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  } as any;
  const repo = new (UserAdminRepository as any)(prisma);
  return { repo, prisma };
}

describe('UserAdminRepository.buildWhere — userIds filter', () => {
  afterEach(() => jest.clearAllMocks());

  it('adiciona filtro id IN quando userIds fornecido', async () => {
    const { repo, prisma } = makeRepo();

    await repo.findAll({ userIds: [1n, 3n, 7n] });

    const whereArg = prisma.user.findMany.mock.calls[0][0].where;
    expect(whereArg.AND).toEqual(
      expect.arrayContaining([{ id: { in: [1n, 3n, 7n] } }]),
    );
  });

  it('não adiciona filtro userIds quando array vazio', async () => {
    const { repo, prisma } = makeRepo();

    await repo.findAll({ userIds: [] });

    const whereArg = prisma.user.findMany.mock.calls[0][0].where;
    const hasUserIdsFilter = (whereArg.AND ?? []).some(
      (c: any) => c.id?.in !== undefined,
    );
    expect(hasUserIdsFilter).toBe(false);
  });

  it('não adiciona filtro userIds quando undefined', async () => {
    const { repo, prisma } = makeRepo();

    await repo.findAll({});

    const whereArg = prisma.user.findMany.mock.calls[0][0].where;
    const hasUserIdsFilter = (whereArg.AND ?? []).some(
      (c: any) => c.id?.in !== undefined,
    );
    expect(hasUserIdsFilter).toBe(false);
  });

  it('combina userIds com outros filtros (search + status)', async () => {
    const { repo, prisma } = makeRepo();

    await repo.findAll({ search: 'john', status: 'active', userIds: [1n, 2n] });

    const whereArg = prisma.user.findMany.mock.calls[0][0].where;
    expect(whereArg.AND.length).toBe(3); // search OR block + status + userIds
  });
});
