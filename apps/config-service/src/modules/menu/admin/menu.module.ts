import { Module } from '@nestjs/common';
import { AdminMenuController } from './controllers/menu.controller';
import { MenuService } from './services/menu.service';
import { EnumModule } from '@package/common';
import * as MenuEnums from '../enums';

@Module({
  imports: [
    EnumModule.register({
      path: 'menus/enums',
      enums: MenuEnums,
    }),
  ],
  controllers: [AdminMenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class AdminMenuModule {}
