import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as os from 'os';
import { SessionContext, SessionServerInfo } from './session-context';
import { sessionContextStorage } from './session-context.storage';

function resolveServerIp(): string | null {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return null;
}

@Injectable()
export class SessionContextService {
  constructor(private readonly config: ConfigService) {}

  fromRequest(req: Request): SessionContext {
    return new SessionContext(req, this.serverInfo());
  }

  current(): SessionContext | undefined {
    return sessionContextStorage.getStore();
  }

  serverInfo(): SessionServerInfo {
    return {
      name:          this.config.get<string>('SERVICE_NAME') ?? 'Service',
      environment:   this.config.get<string>('app.nodeEnv')  ?? process.env.NODE_ENV ?? 'development',
      timezone:      this.config.get<string>('APP_TIMEZONE') ?? process.env.APP_TIMEZONE ?? 'Asia/Ho_Chi_Minh',
      hostname:      os.hostname(),
      ip:            resolveServerIp(),
      port:          this.config.get<number>('app.port') ?? parseInt(process.env.PORT ?? '3000', 10),
      pid:           process.pid,
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }
}
