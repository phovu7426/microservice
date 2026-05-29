import { Request } from 'express';

export interface SessionServerInfo {
  name: string;
  environment: string;
  timezone: string;
  hostname: string;
  ip: string | null;
  port: number;
  pid: number;
  uptimeSeconds: number;
}

export class SessionContext {
  readonly ip: string | null;
  readonly userAgent: string | null;
  readonly language: string | null;
  readonly requestId: string | null;
  readonly server: SessionServerInfo;

  private readonly req: Request;

  constructor(req: Request, server: SessionServerInfo) {
    this.req = req;

    this.ip        = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? null;
    this.userAgent = (req.headers['user-agent'] as string) ?? null;
    this.language  = (req.headers['accept-language'] as string) ?? null;
    this.requestId = (req as any).requestId ?? (req.headers['x-request-id'] as string) ?? null;

    this.server = server;
  }

  private get jwt(): Record<string, any> | undefined {
    return (this.req as any).user as Record<string, any> | undefined;
  }

  get userId(): string | null {
    return this.jwt?.sub ? String(this.jwt.sub) : null;
  }

  get userEmail(): string | null {
    return this.jwt?.email ? String(this.jwt.email) : null;
  }

  get tokenIssuedAt(): string | null {
    return this.jwt?.iat ? new Date(this.jwt.iat * 1000).toISOString() : null;
  }

  get tokenExpiresAt(): string | null {
    return this.jwt?.exp ? new Date(this.jwt.exp * 1000).toISOString() : null;
  }

  get isAuthenticated(): boolean {
    return this.userId !== null;
  }
}
