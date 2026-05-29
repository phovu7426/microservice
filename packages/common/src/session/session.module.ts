import { Global, Module } from '@nestjs/common';
import { SessionContextService } from './session-context.service';
import { SessionContextMiddleware } from './session-context.middleware';

@Global()
@Module({
  providers: [SessionContextService, SessionContextMiddleware],
  exports:   [SessionContextService, SessionContextMiddleware],
})
export class SessionModule {}
