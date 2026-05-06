import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { UploadService } from '../services/upload.service';
import { FileValidationService } from '../services/file-validation.service';
import { Permission } from '@package/common';
import { UploadResponseDto } from '../dtos/upload.dto';
import { FileMetadata } from '../interfaces/upload-strategy.interface';
import { Throttle } from '@nestjs/throttler/dist/throttler.decorator';

// Strategy filenames are `<timestamp>-<rand><ext>`. Restrict :filename param
// to that alphabet so `..`, `/`, `\`, NUL, control chars, and quotes can't
// reach strategy code (path-traversal + Content-Disposition injection).
const SAFE_FILENAME_RE = /^[A-Za-z0-9._-]{1,255}$/;
function assertSafeFilename(filename: string): string {
  if (
    !filename ||
    typeof filename !== 'string' ||
    !SAFE_FILENAME_RE.test(filename) ||
    filename.includes('..')
  ) {
    throw new BadRequestException('Invalid filename');
  }
  return filename;
}

const MAX_UPLOAD_FILES = 10;

@Controller('upload')
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly fileValidationService: FileValidationService,
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
  ) {}

  private get maxFileSize(): number {
    return this.configService.get<number>('storage.maxFileSize', 10_485_760);
  }

  @Permission('storage:write')
  @Post('file')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10_485_760,
        files: 1,
        fields: 5,
        fieldSize: 1024,
        parts: 6,
      },
    }),
  )
  async uploadFile(@UploadedFile() file: any): Promise<UploadResponseDto> {
    if (!file) {
      const lang = I18nContext.current()?.lang ?? 'en';
      throw new BadRequestException(this.i18n.t('upload.FILE_REQUIRED', { lang }));
    }
    if (file.truncated) {
      const lang = I18nContext.current()?.lang ?? 'en';
      throw new BadRequestException(
        this.i18n.t('upload.FILE_TOO_LARGE', {
          lang,
          args: { maxSizeMB: (this.maxFileSize / 1024 / 1024).toFixed(2) },
        }),
      );
    }

    const { sanitizedOriginalName } =
      this.fileValidationService.validateFile(file);
    file.originalname = sanitizedOriginalName;

    return this.uploadService.uploadFile(file);
  }

  @Permission('storage:write')
  @Post('files')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseInterceptors(
    FilesInterceptor('files', MAX_UPLOAD_FILES, {
      limits: {
        fileSize: 10_485_760,
        files: MAX_UPLOAD_FILES,
        fields: 5,
        fieldSize: 1024,
        parts: MAX_UPLOAD_FILES + 5,
      },
    }),
  )
  async uploadFiles(
    @UploadedFiles() files: any[],
  ): Promise<UploadResponseDto[]> {
    if (!files || files.length === 0) {
      const lang = I18nContext.current()?.lang ?? 'en';
      throw new BadRequestException(this.i18n.t('upload.FILES_REQUIRED', { lang }));
    }

    for (const file of files) {
      if (file.truncated) {
        const lang = I18nContext.current()?.lang ?? 'en';
        throw new BadRequestException(
          this.i18n.t('upload.FILE_TOO_LARGE', {
            lang,
            args: { maxSizeMB: (this.maxFileSize / 1024 / 1024).toFixed(2) },
          }),
        );
      }
      const { sanitizedOriginalName } =
        this.fileValidationService.validateFile(file);
      file.originalname = sanitizedOriginalName;
    }

    return this.uploadService.uploadFiles(files);
  }

  @Get()
  @Permission('storage:list')
  async listFiles(
    @Query('prefix') prefix?: string,
    @Query('limit') limit?: string,
  ): Promise<FileMetadata[]> {
    if (prefix && !/^[A-Za-z0-9._/-]{0,128}$/.test(prefix)) {
      throw new BadRequestException('Invalid prefix');
    }
    const parsedLimit = limit
      ? Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500)
      : undefined;
    return this.uploadService.listFiles(prefix, parsedLimit);
  }

  @Get('allowed-types')
  @Permission('public')
  async getAllowedTypes(): Promise<{ types: string[]; maxSize: number }> {
    const types = this.fileValidationService.getAllowedFileTypes();
    return { types, maxSize: this.maxFileSize };
  }

  @Get('meta/:filename')
  @Permission('storage:read')
  async getMetadata(
    @Param('filename') filename: string,
  ): Promise<FileMetadata> {
    return this.uploadService.getFileMetadata(assertSafeFilename(filename));
  }

  @Get(':filename')
  @Permission('storage:read')
  async downloadFile(
    @Param('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    const safe = assertSafeFilename(filename);
    // Read the configured strategy from the Nest config namespace, NOT the
    // raw env var — they may diverge during tests/runtime overrides.
    const storageType = this.configService.get<string>('storage.type', 'local');

    if (storageType === 'local') {
      const { stream } = await this.uploadService.downloadFile(safe);
      // Hardening: prevent MIME sniffing, force download, sandbox via CSP.
      // Override stored mimetype to octet-stream so even if a polyglot
      // (HTML/SVG masquerading as image) slipped through validation, no
      // browser will execute it from the storage origin.
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${safe}"`);
      stream.pipe(res);
    } else {
      const { metadata } = await this.uploadService.downloadFile(safe);
      res.redirect(302, metadata.url);
    }
  }

  @Delete(':filename')
  @Permission('storage:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFile(@Param('filename') filename: string): Promise<void> {
    return this.uploadService.deleteFile(assertSafeFilename(filename));
  }
}
