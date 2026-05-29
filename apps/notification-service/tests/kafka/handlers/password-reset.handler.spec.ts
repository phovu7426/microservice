jest.mock('src/generated/prisma', () => ({ PrismaClient: class {}, Prisma: {} }), { virtual: true });
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));
jest.mock('src/types', () => ({ PrimaryKey: BigInt }), { virtual: true });
jest.mock('@nestjs/bull', () => ({ InjectQueue: () => () => {} }));

import { PasswordResetHandler } from '../../../src/event/kafka/handlers/password-reset.handler';

describe('PasswordResetHandler', () => {
  let handler: PasswordResetHandler;
  let queue: { add: jest.Mock };

  beforeEach(() => {
    queue = { add: jest.fn().mockResolvedValue({}) };
    handler = new PasswordResetHandler(queue as any);
  });

  afterEach(() => jest.clearAllMocks());

  it('should skip when email is missing', async () => {
    await handler.handle({ username: 'john' });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('should skip when email is not a string', async () => {
    await handler.handle({ email: 123 });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('should skip when email is invalid', async () => {
    await handler.handle({ email: 'not-valid' });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('should enqueue reset password email with username', async () => {
    await handler.handle({ email: 'user@test.com', username: 'john', event_id: 'e1' });

    expect(queue.add).toHaveBeenCalledWith(
      'send_email_template',
      expect.objectContaining({
        templateCode: 'reset_password_success',
        options: expect.objectContaining({
          to: 'user@test.com',
          variables: expect.objectContaining({ name: 'john' }),
        }),
      }),
      expect.objectContaining({ attempts: 5, jobId: 'e1' }),
    );
  });

  it('should use email as name when username is empty', async () => {
    await handler.handle({ email: 'user@test.com', username: '' });

    const vars = queue.add.mock.calls[0][1].options.variables;
    expect(vars.name).toBe('user@test.com');
  });

  it('should trim email before use', async () => {
    await handler.handle({ email: '  user@test.com  ' });

    const to = queue.add.mock.calls[0][1].options.to;
    expect(to).toBe('user@test.com');
  });
});
