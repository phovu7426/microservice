import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';
import {
  FileMetadata,
  IUploadStrategy,
  UploadResult,
} from '../interfaces/upload-strategy.interface';

@Injectable()
export class UploadService {
  constructor(
    @Inject('UPLOAD_STRATEGY') private readonly strategy: IUploadStrategy,
    private readonly i18n: I18nService,
  ) {}

  async uploadFile(file: any): Promise<UploadResult> {
    if (!file) {
      const lang = I18nContext.current()?.lang ?? 'en';
      throw new BadRequestException(this.i18n.t('upload.FILE_REQUIRED', { lang }));
    }

    return this.strategy.upload(file);
  }

  async uploadFiles(files: any[]): Promise<UploadResult[]> {
    if (!files || files.length === 0) {
      const lang = I18nContext.current()?.lang ?? 'en';
      throw new BadRequestException(this.i18n.t('upload.FILES_REQUIRED', { lang }));
    }

    // Best-effort cleanup on partial failure: if any single upload throws,
    // delete the ones that already succeeded so we don't leave orphaned
    // blobs in S3/disk/Cloudinary while the caller sees an error.
    const results = await Promise.allSettled(
      files.map((file) => this.strategy.upload(file)),
    );
    const successes: UploadResult[] = [];
    const errors: unknown[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') successes.push(r.value);
      else errors.push(r.reason);
    }
    if (errors.length > 0) {
      for (const s of successes) {
        await this.strategy.delete(s.filename).catch(() => undefined);
      }
      throw errors[0];
    }
    return successes;
  }

  async downloadFile(
    filename: string,
  ): Promise<{ stream: NodeJS.ReadableStream; metadata: FileMetadata }> {
    return this.strategy.download(filename);
  }

  async deleteFile(filename: string): Promise<void> {
    return this.strategy.delete(filename);
  }

  async listFiles(prefix?: string, limit?: number): Promise<FileMetadata[]> {
    return this.strategy.list(prefix, limit);
  }

  async fileExists(filename: string): Promise<boolean> {
    return this.strategy.exists(filename);
  }

  async getFileMetadata(filename: string): Promise<FileMetadata> {
    return this.strategy.getMetadata(filename);
  }
}
