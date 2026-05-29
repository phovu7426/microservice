jest.mock('src/generated/prisma', () => ({ PrismaClient: class {}, Prisma: {} }), { virtual: true });
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));
jest.mock('src/types', () => ({ PrimaryKey: BigInt }), { virtual: true });
jest.mock('@nestjs/bull', () => ({ InjectQueue: () => () => {} }));

import { UserRegisteredHandler } from '../../../src/event/kafka/handlers/user-registered.handler';

describe('UserRegisteredHandler', () => {
  let handler: UserRegisteredHandler;
  let queue: { add: jest.Mock };

  beforeEach(() => {
    queue = { add: jest.fn().mockResolvedValue({}) };
    handler = new UserRegisteredHandler(queue as any);
  });

  afterEach(() => jest.clearAllMocks());

  it('should skip when email is missing', async () => {
    await handler.handle({ username: 'john' });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('should skip when email is invalid', async () => {
    await handler.handle({ email: 'not-valid' });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('should enqueue registration email', async () => {
    await handler.handle({
      email: 'new@user.com',
      username: 'newuser',
      event_id: 'e1',
    });

    expect(queue.add).toHaveBeenCalledWith(
      'send_email_template',
      expect.objectContaining({
        templateCode: 'registration_success',
        options: expect.objectContaining({
          to: 'new@user.com',
          variables: { name: 'newuser', username: 'newuser', email: 'new@user.com' },
        }),
      }),
      expect.objectContaining({ attempts: 5, jobId: 'e1' }),
    );
  });

  it('should use email as name when username is empty', async () => {
    await handler.handle({ email: 'a@b.com', username: '' });

    const vars = queue.add.mock.calls[0][1].options.variables;
    expect(vars.name).toBe('a@b.com');
  });

  it('should trim email whitespace', async () => {
    await handler.handle({ email: '  a@b.com  ' });

    const to = queue.add.mock.calls[0][1].options.to;
    expect(to).toBe('a@b.com');
  });
});
