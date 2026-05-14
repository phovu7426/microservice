import { Module } from '@nestjs/common';
import { EnumModule } from '@package/common';
import { ContextController } from './admin/controllers/context.controller';
import { ContextService } from './admin/services/context.service';
import { ContextRepository } from './repositories/context.repository';
import * as ContextEnums from './enums';

@Module({
  imports: [EnumModule.register({ path: 'contexts/enums', enums: ContextEnums })],
  controllers: [ContextController],
  providers: [ContextService, ContextRepository],
})
export class ContextModule {}
