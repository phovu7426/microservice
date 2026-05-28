import { Module } from '@nestjs/common';
import { EnumModule } from '@package/common';
import * as PartnerEnums from './enums';
import { AdminPartnerController } from './admin/controllers/partner.controller';
import { AdminPartnerService } from './admin/services/partner.service';
import { PublicPartnerController } from './public/controllers/partner.controller';
import { PublicPartnerService } from './public/services/partner.service';
import { PartnerRepository } from './repositories/partner.repository';

@Module({
  imports: [EnumModule.register({ path: 'partners/enums', enums: PartnerEnums })],
  controllers: [AdminPartnerController, PublicPartnerController],
  providers: [PartnerRepository, AdminPartnerService, PublicPartnerService],
  exports: [PartnerRepository],
})
export class PartnerModule {}
