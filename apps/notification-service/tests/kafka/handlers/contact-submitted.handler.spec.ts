jest.mock('src/generated/prisma', () => ({ PrismaClient: class {}, Prisma: {} }), { virtual: true });
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));
jest.mock('src/types', () => ({ PrimaryKey: BigInt }), { virtual: true });
jest.mock('@nestjs/bull', () => ({ InjectQueue: () => () => {} }));

import { ContactSubmittedHandler } from '../../../src/event/kafka/handlers/contact-submitted.handler';

describe('ContactSubmittedHandler', () => {
  let handler: ContactSubmittedHandler;
  let queue: { add: jest.Mock };
  let mailService: { getAdminEmail: jest.Mock };

  beforeEach(() => {
    queue = { add: jest.fn().mockResolvedValue({}) };
    mailService = { getAdminEmail: jest.fn().mockReturnValue('admin@test.com') };
    handler = new ContactSubmittedHandler(queue as any, mailService as any);
  });

  afterEach(() => jest.clearAllMocks());

  it('should skip when admin email is not configured', async () => {
    mailService.getAdminEmail.mockReturnValue(undefined);
    await handler.handle({ name: 'John', email: 'j@test.com' });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('should enqueue contact email to admin', async () => {
    await handler.handle({
      name: 'John',
      email: 'john@test.com',
      phone: '123',
      subject: 'Help',
      message: 'I need help',
      event_id: 'evt-1',
    });

    expect(queue.add).toHaveBeenCalledWith(
      'send_email_template',
      {
        templateCode: 'contact_submitted',
        options: {
          to: 'admin@test.com',
          variables: {
            name: 'John',
            email: 'john@test.com',
            phone: '123',
            subject: 'Help',
            message: 'I need help',
          },
        },
      },
      expect.objectContaining({ attempts: 5, jobId: 'evt-1' }),
    );
  });

  it('should default non-string fields to empty string', async () => {
    await handler.handle({ name: 123, email: null });

    const vars = queue.add.mock.calls[0][1].options.variables;
    expect(vars.name).toBe('');
    expect(vars.email).toBe('');
    expect(vars.phone).toBe('');
    expect(vars.subject).toBe('');
    expect(vars.message).toBe('');
  });

  it('should use id as jobId fallback when event_id is missing', async () => {
    await handler.handle({ name: 'X', id: 'fallback-id' });

    const jobOpts = queue.add.mock.calls[0][2];
    expect(jobOpts.jobId).toBe('fallback-id');
  });
});
