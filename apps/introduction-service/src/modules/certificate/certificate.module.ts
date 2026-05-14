import { Module } from '@nestjs/common';
import { EnumModule } from '@package/common';
import * as CertificateEnums from './enums';
import { AdminCertificateController } from './admin/controllers/certificate.controller';
import { AdminCertificateService } from './admin/services/certificate.service';
import { PublicCertificateController } from './public/controllers/certificate.controller';
import { PublicCertificateService } from './public/services/certificate.service';
import { CertificateRepository } from './repositories/certificate.repository';

@Module({
  imports: [
    EnumModule.register({ path: 'certificates/enums', enums: CertificateEnums }),
  ],
  controllers: [AdminCertificateController, PublicCertificateController],
  providers: [CertificateRepository, AdminCertificateService, PublicCertificateService],
  exports: [CertificateRepository],
})
export class CertificateModule {}
