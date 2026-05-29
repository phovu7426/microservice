import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { SessionContextService } from './session-context.service';
import { sessionContextStorage } from './session-context.storage';

@Injectable()
export class SessionContextMiddleware implements NestMiddleware {
  constructor(private readonly sessionCtx: SessionContextService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const ctx = this.sessionCtx.fromRequest(req);
    sessionContextStorage.run(ctx, next);
  }
}
