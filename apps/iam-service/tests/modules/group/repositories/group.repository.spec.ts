jest.mock('src/generated/prisma', () => ({ Prisma: {} }), { virtual: true });
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));
jest.mock('src/types', () => ({
  toPrimaryKey: (v: any) => BigInt(v),
}), { virtual: true });
jest.mock('../../../../src/core/database/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { GroupRepository } from '../../../../src/modules/group/repositories/group.repository';

function makeRepo() {
  const prisma = {
    userGroup: {
      findMany: jest.fn(),
    },
  } as any;
  const repo = new (GroupRepository as any)(prisma);
  return { repo, prisma };
}

describe('GroupRepository.findMemberIds', () => {
  afterEach(() => jest.clearAllMocks());

  it('retorna lista de userIds como bigint', async () => {
    const { repo, prisma } = makeRepo();
    prisma.userGroup.findMany.mockResolvedValue([
      { userId: 1n },
      { userId: 3n },
      { userId: 7n },
    ]);

    const result = await repo.findMemberIds(5n);

    expect(prisma.userGroup.findMany).toHaveBeenCalledWith({
      where: { groupId: 5n },
      select: { userId: true },
    });
    expect(result).toEqual([1n, 3n, 7n]);
  });

  it('retorna array vazio quando grupo não tem membros', async () => {
    const { repo, prisma } = makeRepo();
    prisma.userGroup.findMany.mockResolvedValue([]);

    const result = await repo.findMemberIds(99n);

    expect(result).toEqual([]);
  });
});
