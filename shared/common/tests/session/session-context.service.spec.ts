import { SessionContextService } from '../../src/session/session-context.service';
import { SessionContext } from '../../src/session/session-context';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const mockConfig = { get: jest.fn() };

function buildService(): SessionContextService {
  return new SessionContextService(mockConfig as any);
}

function mockReq(overrides: Record<string, any> = {}): any {
  return {
    user: { sub: '42', email: 'user@example.com', iat: 1700000000, exp: 1700003600 },
    ip: '10.0.0.1',
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'accept-language': 'vi-VN,vi;q=0.9',
    },
    requestId: 'req-id-123',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('SessionContextService', () => {
  let service: SessionContextService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = buildService();
    mockConfig.get.mockImplementation((key: string) => ({
      SERVICE_NAME: 'Comic Service',
      'app.nodeEnv': 'development',
      APP_TIMEZONE: 'Asia/Ho_Chi_Minh',
    }[key]));
    jest.spyOn(process, 'uptime').mockReturnValue(7200);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('fromRequest', () => {
    it('trả về SessionContext instance', () => {
      expect(service.fromRequest(mockReq())).toBeInstanceOf(SessionContext);
    });

    it('lấy userId và email từ JWT payload', () => {
      const ctx = service.fromRequest(mockReq());
      expect(ctx.userId).toBe('42');
      expect(ctx.userEmail).toBe('user@example.com');
    });

    it('chuyển iat/exp thành ISO string', () => {
      const ctx = service.fromRequest(mockReq());
      expect(ctx.tokenIssuedAt).toBe(new Date(1700000000 * 1000).toISOString());
      expect(ctx.tokenExpiresAt).toBe(new Date(1700003600 * 1000).toISOString());
    });

    it('lấy ip, userAgent, language, requestId từ request', () => {
      const ctx = service.fromRequest(mockReq());
      expect(ctx.ip).toBe('10.0.0.1');
      expect(ctx.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
      expect(ctx.language).toBe('vi-VN,vi;q=0.9');
      expect(ctx.requestId).toBe('req-id-123');
    });

    it('fallback ip về x-forwarded-for khi req.ip undefined', () => {
      const ctx = service.fromRequest(mockReq({
        ip: undefined,
        headers: { 'x-forwarded-for': '203.0.113.5' },
      }));
      expect(ctx.ip).toBe('203.0.113.5');
    });

    it('fallback requestId về x-request-id header', () => {
      const ctx = service.fromRequest(mockReq({
        requestId: undefined,
        headers: { 'x-request-id': 'header-id-999' },
      }));
      expect(ctx.requestId).toBe('header-id-999');
    });

    it('isAuthenticated = true khi có userId', () => {
      expect(service.fromRequest(mockReq()).isAuthenticated).toBe(true);
    });

    it('isAuthenticated = false khi request không có user', () => {
      const ctx = service.fromRequest(mockReq({ user: undefined }));
      expect(ctx.isAuthenticated).toBe(false);
      expect(ctx.userId).toBeNull();
    });

    it('tokenIssuedAt/tokenExpiresAt là null khi không có iat/exp', () => {
      const ctx = service.fromRequest(mockReq({ user: { sub: '1' } }));
      expect(ctx.tokenIssuedAt).toBeNull();
      expect(ctx.tokenExpiresAt).toBeNull();
    });
  });

  describe('group context', () => {
    it('groupId retorna bigint quando x-group-id é válido', () => {
      const ctx = service.fromRequest(mockReq({ headers: { 'x-group-id': '42' } }));
      expect(ctx.groupId).toBe(42n);
    });

    it('groupId retorna null quando header ausente', () => {
      const ctx = service.fromRequest(mockReq());
      expect(ctx.groupId).toBeNull();
    });

    it('groupId retorna null quando header não é número', () => {
      const ctx = service.fromRequest(mockReq({ headers: { 'x-group-id': 'abc' } }));
      expect(ctx.groupId).toBeNull();
    });

    it('isSystemContext = false quando groupId presente', () => {
      const ctx = service.fromRequest(mockReq({ headers: { 'x-group-id': '5' } }));
      expect(ctx.isSystemContext).toBe(false);
    });

    it('isSystemContext = true quando groupId ausente', () => {
      const ctx = service.fromRequest(mockReq());
      expect(ctx.isSystemContext).toBe(true);
    });
  });

  describe('serverInfo', () => {
    it('trả về đầy đủ các field server', () => {
      const info = service.serverInfo();
      expect(info.name).toBe('Comic Service');
      expect(info.environment).toBe('development');
      expect(info.timezone).toBe('Asia/Ho_Chi_Minh');
      expect(info.uptimeSeconds).toBe(7200);
      expect(typeof info.hostname).toBe('string');
      expect(info.hostname.length).toBeGreaterThan(0);
      expect(typeof info.pid).toBe('number');
      expect(info.pid).toBe(process.pid);
      expect(typeof info.port).toBe('number');
    });

    it('ip là string hoặc null (tuỳ môi trường)', () => {
      const info = service.serverInfo();
      expect(info.ip === null || typeof info.ip === 'string').toBe(true);
    });

    it('fallback về process.env khi ConfigService trả về undefined', () => {
      mockConfig.get.mockReturnValue(undefined);
      const info = service.serverInfo();
      expect(typeof info.name).toBe('string');
      expect(typeof info.environment).toBe('string');
      expect(typeof info.timezone).toBe('string');
    });
  });
});
