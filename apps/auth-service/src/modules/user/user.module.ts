import { Module } from '@nestjs/common';
import { EnumModule } from '@package/common';
import * as UserEnums from './enums';
import { UserAdminRepository } from './repositories/user-admin.repository';
import { AdminUserController } from './admin/controllers/user.controller';
import { AdminUserService } from './admin/services/user.service';
import { ProfileController } from './user/controllers/profile.controller';
import { ProfileService } from './user/services/profile.service';

@Module({
  imports: [
    EnumModule.register({ path: 'users/enums', enums: UserEnums }),
  ],
  controllers: [AdminUserController, ProfileController],
  providers: [UserAdminRepository, AdminUserService, ProfileService],
})
export class UserModule {}
