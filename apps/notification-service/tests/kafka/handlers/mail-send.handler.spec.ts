jest.mock('src/generated/prisma', () => ({ PrismaClient: class {}, Prisma: {} }), { virtual: true });
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));
jest.mock('src/types', () => ({ PrimaryKey: BigInt }), { virtual: true });
jest.mock('@nestjs/bull', () => ({ InjectQueue: () => () => {} }));

import { MailSendHandler } from '../../../src/event/kafka/handlers/mail-send.handler';

describe('MailSendHandler', () => {
  let handler: MailSendHandler;
  let queue: { add: jest.Mock };

  beforeEach(() => {
    queue = { add: jest.fn().mockResolvedValue({}) };
    handler = new MailSendHandler(queue as any);
  });

  afterEach(() => jest.clearAllMocks());

  it('should skip when templateCode is missing', async () => {
    await handler.handle({ to: 'a@b.com' });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('should skip when templateCode is not a string', async () => {
    await handler.handle({ templateCode: 123, to: 'a@b.com' });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('should skip when templateCode fails regex (uppercase)', async () => {
    await handler.handle({ templateCode: 'InvalidCode', to: 'a@b.com' });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('should skip when no valid recipients', async () => {
    await handler.handle({ templateCode: 'welcome_email', to: 'not-an-email' });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('should skip when recipients exceed max (50)', async () => {
    const to = Array.from({ length: 51 }, (_, i) => `user${i}@example.com`);
    await handler.handle({ templateCode: 'welcome_email', to });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('should enqueue email job with valid payload', async () => {
    await handler.handle({
      templateCode: 'welcome_email',
      to: 'user@example.com',
      variables: { name: 'John' },
      event_id: 'evt-1',
    });

    expect(queue.add).toHaveBeenCalledWith(
      'send_email_template',
      {
        templateCode: 'welcome_email',
        options: { to: ['user@example.com'], variables: { name: 'John' } },
      },
      expect.objectContaining({
        attempts: 5,
        jobId: 'evt-1',
      }),
    );
  });

  it('should handle array of recipients and filter invalid ones', async () => {
    await handler.handle({
      templateCode: 'welcome_email',
      to: ['valid@test.com', 'bad', 'also-valid@test.com'],
    });

    const callArgs = queue.add.mock.calls[0][1];
    expect(callArgs.options.to).toEqual(['valid@test.com', 'also-valid@test.com']);
  });

  it('should default variables to empty object when not provided', async () => {
    await handler.handle({ templateCode: 'welcome_email', to: 'a@b.com' });

    const callArgs = queue.add.mock.calls[0][1];
    expect(callArgs.options.variables).toEqual({});
  });

  it('should handle null payload gracefully', async () => {
    await handler.handle(null);
    expect(queue.add).not.toHaveBeenCalled();
  });
});
