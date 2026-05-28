import { Module } from '@nestjs/common';
import { EnumModule } from '@package/common';
import * as GalleryEnums from './enums';
import { AdminGalleryController } from './admin/controllers/gallery.controller';
import { AdminGalleryService } from './admin/services/gallery.service';
import { PublicGalleryController } from './public/controllers/gallery.controller';
import { PublicGalleryService } from './public/services/gallery.service';
import { GalleryRepository } from './repositories/gallery.repository';

@Module({
  imports: [EnumModule.register({ path: 'galleries/enums', enums: GalleryEnums })],
  controllers: [AdminGalleryController, PublicGalleryController],
  providers: [GalleryRepository, AdminGalleryService, PublicGalleryService],
  exports: [GalleryRepository],
})
export class GalleryModule {}
