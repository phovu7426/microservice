import { Module } from '@nestjs/common';
import { EnumModule } from '@package/common';
import * as StaffEnums from './enums';
import { AdminStaffController } from './admin/controllers/staff.controller';
import { AdminStaffService } from './admin/services/staff.service';
import { PublicStaffController } from './public/controllers/staff.controller';
import { PublicStaffService } from './public/services/staff.service';
import { StaffRepository } from './repositories/staff.repository';

@Module({
  imports: [EnumModule.register({ path: 'staff/enums', enums: StaffEnums })],
  controllers: [AdminStaffController, PublicStaffController],
  providers: [StaffRepository, AdminStaffService, PublicStaffService],
  exports: [StaffRepository],
})
export class StaffModule {}
