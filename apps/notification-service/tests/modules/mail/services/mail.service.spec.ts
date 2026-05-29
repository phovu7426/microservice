// Module mocks - must come before any import
jest.mock('src/generated/prisma', () => ({ PrismaClient: class {}, Prisma: {} }), { virtual: true });
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));
jest.mock('@package/common', () => ({
  t: (_i18n: any, key: string) => key,
}));
jest.mock('@package/redis', () => ({ RedisService: jest.fn() }));
jest.mock('@package/circuit-breaker', () => ({
  createCircuitBreaker: jest.fn().mockReturnValue({
    execute: jest.fn((fn: any) => fn()),
    onBreak: jest.fn(),
  }),
}));
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
  }),
}));
jest.mock('src/types', () => ({ PrimaryKey: BigInt }), { virtual: true });

import * as nodemailer from 'nodemailer';
import { MailService, PermanentMailError } from '../../../../src/modules/mail/services/mail.service';
import { ConfigClient } from '../../../../src/clients/config.client';
import { ContentTemplateRepository } from '../../../../src/modules/content-template/repositories/content-template.repository';

describe('MailService', () => {
  let service: MailService;
  let configClient: jest.Mocked<Partial<ConfigClient>>;
  let templateRepo: jest.Mocked<Partial<ContentTemplateRepository>>;
  let redis: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    incr: jest.Mock;
    expire: jest.Mock;
    isEnabled: jest.Mock;
  };
  let mockSendMail: jest.Mock;

  const emailConfig = {
    smtpHost: 'smtp.test.com',
    smtpPort: 587,
    smtpSecure: false,
    smtpUsername: 'user@test.com',
    smtpPassword: 'secret',
    fromEmail: 'noreply@test.com',
    fromName: 'TestApp',
    replyToEmail: 'admin@test.com',
  };

  beforeEach(async () => {
    mockSendMail = jest.fn().mockResolvedValue({ messageId: 'msg-1' });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: mockSendMail,
    });

    configClient = {
      getEmailConfig: jest.fn().mockResolvedValue(emailConfig),
    };

    templateRepo = {
      findActiveByCode: jest.fn(),
    };

    redis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      isEnabled: jest.fn().mockReturnValue(true),
    };

    const fileLogger = {
      create: jest.fn().mockReturnValue({
        addDebug: jest.fn(),
        addInfo: jest.fn(),
        addException: jest.fn(),
        save: jest.fn(),
      }),
    };

    service = new MailService(
      configClient as any,
      templateRepo as any,
      redis as any,
      fileLogger as any,
    );

    // Initialize (loads config + creates transporter)
    await service.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('reloadConfig', () => {
    it('should create transporter with valid config', async () => {
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.test.com',
          port: 587,
          secure: false,
          auth: { user: 'user@test.com', pass: 'secret' },
        }),
      );
    });

    it('should not create transporter when config is null', async () => {
      (nodemailer.createTransport as jest.Mock).mockClear();
      configClient.getEmailConfig!.mockResolvedValue(null);

      await service.reloadConfig();

      expect(nodemailer.createTransport).not.toHaveBeenCalled();
    });

    it('should not create transporter when smtpHost is missing', async () => {
      (nodemailer.createTransport as jest.Mock).mockClear();
      configClient.getEmailConfig!.mockResolvedValue({ ...emailConfig, smtpHost: '' });

      await service.reloadConfig();

      expect(nodemailer.createTransport).not.toHaveBeenCalled();
    });

    it('should not create transporter when smtpUsername is missing', async () => {
      (nodemailer.createTransport as jest.Mock).mockClear();
      configClient.getEmailConfig!.mockResolvedValue({ ...emailConfig, smtpUsername: '' });

      await service.reloadConfig();

      expect(nodemailer.createTransport).not.toHaveBeenCalled();
    });

    it('should set adminEmail from replyToEmail', () => {
      expect(service.getAdminEmail()).toBe('admin@test.com');
    });

    it('should fall back to fromEmail when replyToEmail is empty', async () => {
      configClient.getEmailConfig!.mockResolvedValue({ ...emailConfig, replyToEmail: '' });

      await service.reloadConfig();

      expect(service.getAdminEmail()).toBe('noreply@test.com');
    });
  });

  describe('send', () => {
    it('should send email successfully', async () => {
      await service.send({ to: 'user@example.com', subject: 'Test', html: '<p>Hi</p>' });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Test',
          html: '<p>Hi</p>',
        }),
      );
    });

    it('should set from address with name', async () => {
      await service.send({ to: 'user@example.com', subject: 'Test', html: '<p>Hi</p>' });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'TestApp <noreply@test.com>',
        }),
      );
    });

    it('should handle array of recipients', async () => {
      await service.send({ to: ['a@b.com', 'c@d.com'], subject: 'Test', html: '<p>Hi</p>' });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['a@b.com', 'c@d.com'],
        }),
      );
    });

    it('should unwrap single recipient from array', async () => {
      redis.incr.mockResolvedValue(1);

      await service.send({ to: ['only@one.com'], subject: 'Test', html: '<p>Hi</p>' });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'only@one.com',
        }),
      );
    });

    it('should throw Error when transporter is not configured', async () => {
      // Create a service without initializing
      const uninitFileLogger = {
        create: jest.fn().mockReturnValue({
          addDebug: jest.fn(),
          addInfo: jest.fn(),
          addException: jest.fn(),
          save: jest.fn(),
        }),
      };
      const uninitService = new MailService(
        configClient as any,
        templateRepo as any,
        redis as any,
        uninitFileLogger as any,
      );
      configClient.getEmailConfig!.mockResolvedValue(null);
      await uninitService.onModuleInit();

      await expect(
        uninitService.send({ to: 'a@b.com', subject: 'Test', html: '<p>Hi</p>' }),
      ).rejects.toThrow('Mail transport not configured');
    });

    it('should throw PermanentMailError for 5xx SMTP errors', async () => {
      const smtpError = new Error('Mailbox not found') as any;
      smtpError.responseCode = 550;
      mockSendMail.mockRejectedValue(smtpError);

      await expect(
        service.send({ to: 'bounce@example.com', subject: 'Test', html: '<p>Hi</p>' }),
      ).rejects.toThrow(PermanentMailError);
    });

    it('should throw PermanentMailError for EENVELOPE errors', async () => {
      const smtpError = new Error('Invalid envelope') as any;
      smtpError.code = 'EENVELOPE';
      mockSendMail.mockRejectedValue(smtpError);

      await expect(
        service.send({ to: 'bad@example.com', subject: 'Test', html: '<p>Hi</p>' }),
      ).rejects.toThrow(PermanentMailError);
    });

    it('should throw PermanentMailError for EAUTH errors', async () => {
      const smtpError = new Error('Auth failed') as any;
      smtpError.code = 'EAUTH';
      mockSendMail.mockRejectedValue(smtpError);

      await expect(
        service.send({ to: 'x@example.com', subject: 'Test', html: '<p>Hi</p>' }),
      ).rejects.toThrow(PermanentMailError);
    });

    it('should rethrow transient errors as-is', async () => {
      const transientError = new Error('Connection timeout') as any;
      transientError.responseCode = 421;
      mockSendMail.mockRejectedValue(transientError);

      await expect(
        service.send({ to: 'a@example.com', subject: 'Test', html: '<p>Hi</p>' }),
      ).rejects.toThrow('Connection timeout');
      await expect(
        service.send({ to: 'a@example.com', subject: 'Test', html: '<p>Hi</p>' }),
      ).rejects.not.toBeInstanceOf(PermanentMailError);
    });
  });

  describe('rate limiting', () => {
    it('should allow recipients under rate limit', async () => {
      redis.incr.mockResolvedValue(1);

      await service.send({ to: 'user@example.com', subject: 'Test', html: '<p>Hi</p>' });

      expect(redis.incr).toHaveBeenCalledWith('mail:rl:user@example.com');
      expect(redis.expire).toHaveBeenCalledWith('mail:rl:user@example.com', 3600);
      expect(mockSendMail).toHaveBeenCalled();
    });

    it('should set TTL only on first increment', async () => {
      redis.incr.mockResolvedValue(2);

      await service.send({ to: 'user@example.com', subject: 'Test', html: '<p>Hi</p>' });

      expect(redis.expire).not.toHaveBeenCalled();
    });

    it('should filter out rate-limited recipients', async () => {
      redis.incr.mockResolvedValue(11); // exceeds limit of 10

      await service.send({ to: 'spammer@example.com', subject: 'Test', html: '<p>Hi</p>' });

      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should skip all recipients when all are rate-limited', async () => {
      redis.incr.mockResolvedValue(11);

      await service.send({ to: ['a@b.com', 'c@d.com'], subject: 'Test', html: '<p>Hi</p>' });

      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should allow recipients through when redis is disabled', async () => {
      redis.isEnabled.mockReturnValue(false);

      await service.send({ to: 'user@example.com', subject: 'Test', html: '<p>Hi</p>' });

      expect(redis.incr).not.toHaveBeenCalled();
      expect(mockSendMail).toHaveBeenCalled();
    });

    it('should allow recipient through when redis incr fails', async () => {
      redis.incr.mockRejectedValue(new Error('Redis down'));

      await service.send({ to: 'user@example.com', subject: 'Test', html: '<p>Hi</p>' });

      expect(mockSendMail).toHaveBeenCalled();
    });
  });

  describe('sendTemplate', () => {
    it('should render template and send email', async () => {
      templateRepo.findActiveByCode!.mockResolvedValue({
        ...{ id: 1n, code: 'welcome', name: 'Welcome', type: 'email', category: 'render', status: 'active' },
        content: '<h1>Hello {{ name }}</h1><p>Your code is {{ code }}</p>',
        metadata: { subject: 'Welcome!' },
      });

      await service.sendTemplate('welcome', {
        to: 'user@example.com',
        variables: { name: 'John', code: 'ABC123' },
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Welcome!',
          html: '<h1>Hello John</h1><p>Your code is ABC123</p>',
        }),
      );
    });

    it('should use provided subject over metadata subject', async () => {
      templateRepo.findActiveByCode!.mockResolvedValue({
        id: 1n, code: 'test', name: 'Test Template', content: '<p>Body</p>',
        metadata: { subject: 'Default Subject' },
        type: 'email', category: 'render', status: 'active',
      });

      await service.sendTemplate('test', {
        to: 'user@example.com',
        subject: 'Custom Subject',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'Custom Subject' }),
      );
    });

    it('should fall back to template name when no subject provided', async () => {
      templateRepo.findActiveByCode!.mockResolvedValue({
        id: 1n, code: 'test', name: 'My Template', content: '<p>Body</p>',
        metadata: {},
        type: 'email', category: 'render', status: 'active',
      });

      await service.sendTemplate('test', { to: 'user@example.com' });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'My Template' }),
      );
    });

    it('should skip sending when template not found', async () => {
      templateRepo.findActiveByCode!.mockResolvedValue(null);

      await service.sendTemplate('nonexistent', { to: 'user@example.com' });

      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should skip sending when template content is empty', async () => {
      templateRepo.findActiveByCode!.mockResolvedValue({
        id: 1n, code: 'empty', name: 'Empty', content: '',
        metadata: {}, type: 'email', category: 'render', status: 'active',
      });

      await service.sendTemplate('empty', { to: 'user@example.com' });

      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should escape HTML in variable values', async () => {
      templateRepo.findActiveByCode!.mockResolvedValue({
        id: 1n, code: 'xss', name: 'XSS Test', content: '<p>{{ name }}</p>',
        metadata: { subject: 'Test' }, type: 'email', category: 'render', status: 'active',
      });

      await service.sendTemplate('xss', {
        to: 'user@example.com',
        variables: { name: '<script>alert("xss")</script>' },
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: '<p>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</p>',
        }),
      );
    });

    it('should preserve unmatched placeholders', async () => {
      templateRepo.findActiveByCode!.mockResolvedValue({
        id: 1n, code: 'partial', name: 'Partial', content: '<p>{{ name }} and {{ missing }}</p>',
        metadata: { subject: 'Test' }, type: 'email', category: 'render', status: 'active',
      });

      await service.sendTemplate('partial', {
        to: 'user@example.com',
        variables: { name: 'John' },
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: '<p>John and {{ missing }}</p>',
        }),
      );
    });

    it('should resolve nested variable paths', async () => {
      templateRepo.findActiveByCode!.mockResolvedValue({
        id: 1n, code: 'nested', name: 'Nested', content: '<p>{{ user.name }}</p>',
        metadata: { subject: 'Test' }, type: 'email', category: 'render', status: 'active',
      });

      await service.sendTemplate('nested', {
        to: 'user@example.com',
        variables: { user: { name: 'Alice' } },
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: '<p>Alice</p>',
        }),
      );
    });
  });

  describe('ensureFreshConfig', () => {
    it('should not reload when config is fresh', async () => {
      configClient.getEmailConfig!.mockClear();

      await service.ensureFreshConfig();

      // Config was just loaded in onModuleInit, should not reload
      expect(configClient.getEmailConfig).not.toHaveBeenCalled();
    });

    it('should reload when config is stale', async () => {
      // Force stale config by manipulating lastConfigLoadMs via private access
      (service as any).lastConfigLoadMs = 0;
      configClient.getEmailConfig!.mockClear();

      await service.ensureFreshConfig();

      expect(configClient.getEmailConfig).toHaveBeenCalled();
    });

    it('should deduplicate concurrent reload calls', async () => {
      (service as any).lastConfigLoadMs = 0;
      configClient.getEmailConfig!.mockClear();

      // Fire two concurrent ensureFreshConfig calls
      await Promise.all([
        service.ensureFreshConfig(),
        service.ensureFreshConfig(),
      ]);

      // Should only have called getEmailConfig once due to dedup
      expect(configClient.getEmailConfig).toHaveBeenCalledTimes(1);
    });
  });
});
