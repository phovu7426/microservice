import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UploadController } from './controllers/upload.controller';
import { UploadService } from './services/upload.service';
import { FileValidationService } from './services/file-validation.service';
import { LocalStorageStrategy } from './strategies/local.strategy';
import { S3StorageStrategy } from './strategies/s3.strategy';
import { CloudinaryStorageStrategy } from './strategies/cloudinary.strategy';

@Module({
  imports: [ConfigModule],
  controllers: [UploadController],
  providers: [
    UploadService,
    FileValidationService,
    LocalStorageStrategy,
    S3StorageStrategy,
    CloudinaryStorageStrategy,
    {
      provide: 'UPLOAD_STRATEGY',
      useFactory: (
        config: ConfigService,
        local: LocalStorageStrategy,
        s3: S3StorageStrategy,
        cloudinary: CloudinaryStorageStrategy,
      ) => {
        const type = config.get<string>('storage.type', 'local');
        if (type === 'cloudinary') return cloudinary;
        if (type === 's3') return s3;
        return local;
      },
      inject: [ConfigService, LocalStorageStrategy, S3StorageStrategy, CloudinaryStorageStrategy],
    },
  ],
  exports: [UploadService],
})
export class UploadModule {}
