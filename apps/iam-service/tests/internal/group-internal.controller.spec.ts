jest.mock('@package/common', () => ({
  Internal: () => () => {},
  InternalGuard: jest.fn(),
  ParseBigIntPipe: jest.fn(),
  ResponseUtil: {
    success: jest.fn((data) => ({ success: true, data })),
  },
}));

jest.mock('../../src/modules/group/repositories/group.repository', () => ({
  GroupRepository: jest.fn(),
}));

import { GroupInternalController } from '../../src/internal/controllers/group-internal.controller';
import { GroupRepository } from '../../src/modules/group/repositories/group.repository';

function makeController() {
  const repo = {
    findMemberIds: jest.fn(),
  } as jest.Mocked<Partial<GroupRepository>>;
  const controller = new (GroupInternalController as any)(repo);
  return { controller, repo };
}

describe('GroupInternalController', () => {
  afterEach(() => jest.clearAllMocks());

  describe('getMemberIds', () => {
    it('retorna userIds como strings', async () => {
      const { controller, repo } = makeController();
      repo.findMemberIds!.mockResolvedValue([1n, 3n, 7n]);

      const result = await controller.getMemberIds(5n);

      expect(repo.findMemberIds).toHaveBeenCalledWith(5n);
      expect(result.data.userIds).toEqual(['1', '3', '7']);
    });

    it('retorna array vazio quando grupo sem membros', async () => {
      const { controller, repo } = makeController();
      repo.findMemberIds!.mockResolvedValue([]);

      const result = await controller.getMemberIds(99n);

      expect(result.data.userIds).toEqual([]);
    });
  });
});
