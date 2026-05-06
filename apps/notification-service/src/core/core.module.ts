import { Global, Module } from '@nestjs/common';
import { FileLogger } from '@package/bootstrap';
import { DatabaseModule } from './database/database.module';
import { PrismaService } from './database/prisma.service';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [FileLogger],
  exports: [PrismaService, FileLogger],
})
export class CoreModule {}
