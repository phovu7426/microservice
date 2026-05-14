jest.mock('@package/circuit-breaker', () => ({
  createCircuitBreaker: jest.fn(() => ({
    execute: jest.fn((fn: () => any) => fn()),
    onBreak: jest.fn(),
  })),
}));

jest.mock('@package/redis', () => ({ RedisService: jest.fn() }));

import { IamClient } from '../../src/clients/iam.client';

function makeClient(overrides: { baseUrl?: string; redisGet?: any; redisSet?: any } = {}) {
  const redis = {
    get: overrides.redisGet ?? jest.fn().mockResolvedValue(null),
    set: overrides.redisSet ?? jest.fn().mockResolvedValue('OK'),
  } as any;

  const config = {
    get: jest.fn((key: string, def = '') => {
      if (key === 'IAM_INTERNAL_URL') return overrides.baseUrl ?? 'http://iam:3002';
      if (key === 'INTERNAL_API_SECRET') return 'secret-key';
      return def;
    }),
  } as any;

  const client = new IamClient(config, redis);
  client.onModuleInit();
  return { client, redis };
}

describe('IamClient.getGroupMemberIds', () => {
  afterEach(() => jest.clearAllMocks());

  it('retorna userIds do cache Redis quando disponível', async () => {
    const { client, redis } = makeClient({
      redisGet: jest.fn().mockResolvedValue(JSON.stringify(['1', '3', '7'])),
    });

    const result = await client.getGroupMemberIds('5');

    expect(redis.get).toHaveBeenCalledWith('group:members:5');
    expect(result).toEqual([1n, 3n, 7n]);
  });

  it('chỉ gọi fetch khi cache miss, armazenar resultado no Redis', async () => {
    const { client, redis } = makeClient();
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { userIds: ['1', '2'] } }),
    });
    global.fetch = mockFetch as any;

    const result = await client.getGroupMemberIds('5');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://iam:3002/internal/groups/5/member-ids',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ 'x-internal-secret': 'secret-key' }),
      }),
    );
    expect(redis.set).toHaveBeenCalledWith(
      'group:members:5',
      JSON.stringify(['1', '2']),
      120,
    );
    expect(result).toEqual([1n, 2n]);
  });

  it('retorna [] quando IAM retorna lista vazia', async () => {
    const { client } = makeClient();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { userIds: [] } }),
    }) as any;

    const result = await client.getGroupMemberIds('99');
    expect(result).toEqual([]);
  });

  it('continua quando Redis está indisponível (cache miss)', async () => {
    const { client } = makeClient({
      redisGet: jest.fn().mockRejectedValue(new Error('Redis down')),
      redisSet: jest.fn().mockRejectedValue(new Error('Redis down')),
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { userIds: ['5'] } }),
    }) as any;

    const result = await client.getGroupMemberIds('1');
    expect(result).toEqual([5n]);
  });
});
