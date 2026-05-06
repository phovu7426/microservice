import { Global, Module } from '@nestjs/common';
import { ConfigClient } from './config.client';

@Global()
@Module({
  providers: [ConfigClient],
  exports: [ConfigClient],
})
export class ClientsModule {}
