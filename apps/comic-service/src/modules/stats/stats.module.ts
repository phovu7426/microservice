import { Module } from '@nestjs/common';
import { EnumModule } from '@package/common';
import { AdminStatsController } from './admin/controllers/admin-stats.controller';
import { AdminStatsService } from './admin/services/admin-stats.service';
import { StatsRepository } from './repositories/stats.repository';
import * as StatsEnums from './enums';

@Module({
  imports: [EnumModule.register({ path: 'comics/stats/enums', enums: StatsEnums })],
  controllers: [AdminStatsController],
  providers: [StatsRepository, AdminStatsService],
})
export class StatsModule {}
