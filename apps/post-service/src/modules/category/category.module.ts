import { Module } from '@nestjs/common';
import { AdminCategoryController } from './admin/controllers/category.controller';
import { AdminCategoryService } from './admin/services/category.service';
import { PublicCategoryController } from './public/controllers/category.controller';
import { PublicCategoryService } from './public/services/category.service';
import { CategoryRepository } from './repositories/category.repository';
import { EnumModule } from '@package/common';
import * as CategoryEnums from './enums';

@Module({
  imports: [EnumModule.register({ path: 'post-categories/enums', enums: CategoryEnums })],
  controllers: [AdminCategoryController, PublicCategoryController],
  providers: [CategoryRepository, AdminCategoryService, PublicCategoryService],
  exports: [CategoryRepository],
})
export class CategoryModule {}
