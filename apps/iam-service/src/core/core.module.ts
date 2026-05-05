import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { PrismaService } from './database/prisma.service';

@Global()
@Module({
  imports: [DatabaseModule],
  exports: [PrismaService],
})
export class CoreModule {}
