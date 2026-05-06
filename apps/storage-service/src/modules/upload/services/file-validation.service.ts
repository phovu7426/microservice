import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nContext, I18nService } from 'nestjs-i18n';

/**
 * File type definitions with MIME types and magic bytes
 */
interface FileTypeConfig {
  extensions: string[];
  mimeTypes: string[];
  magicBytes?: number[][]; // Magic bytes signatures for content validation
}

@Injectable()
export class FileValidationService {
  private readonly allowedFileTypes: Map<string, FileTypeConfig>;
  private readonly maxFileSize: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
  ) {
    this.maxFileSize = this.configService.get<number>(
      'storage.maxFileSize',
      10485760,
    ); // 10MB default

    // Define allowed file types with their MIME types and magic bytes
    this.allowedFileTypes = new Map([
      // Images
      [
        'image',
        {
          // NOTE: SVG intentionally excluded because it can embed scripts and cause XSS when served as image/svg+xml.
          extensions: [
            '.jpg',
            '.jpeg',
            '.png',
            '.gif',
            '.webp',
            '.bmp',
            '.ico',
          ],
          mimeTypes: [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/bmp',
            'image/x-icon',
            'image/vnd.microsoft.icon',
          ],
          magicBytes: [
            [0xff, 0xd8, 0xff], // JPEG
            [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], // PNG
            [0x47, 0x49, 0x46, 0x38], // GIF
            [0x52, 0x49, 0x46, 0x46], // WEBP (RIFF)
            [0x42, 0x4d], // BMP
          ],
        },
      ],
      // Documents
      [
        'document',
        {
          extensions: [
            '.pdf',
            '.doc',
            '.docx',
            '.xls',
            '.xlsx',
            '.ppt',
            '.pptx',
            '.txt',
            '.csv',
          ],
          mimeTypes: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
            'text/csv',
          ],
          magicBytes: [
            [0x25, 0x50, 0x44, 0x46], // PDF
            [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], // MS Office (doc, xls, ppt)
            [0x50, 0x4b, 0x03, 0x04], // Office 2007+ (docx, xlsx, pptx) - ZIP signature
          ],
        },
      ],
      // Archives
      [
        'archive',
        {
          extensions: ['.zip', '.rar', '.7z', '.tar', '.gz'],
          mimeTypes: [
            'application/zip',
            'application/x-rar-compressed',
            'application/x-7z-compressed',
            'application/x-tar',
            'application/gzip',
          ],
          magicBytes: [
            [0x50, 0x4b, 0x03, 0x04], // ZIP
            [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07], // RAR
            [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c], // 7Z
          ],
        },
      ],
      // Videos
      [
        'video',
        {
          extensions: ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv'],
          mimeTypes: [
            'video/mp4',
            'video/x-msvideo',
            'video/quicktime',
            'video/x-ms-wmv',
            'video/x-flv',
            'video/webm',
            'video/x-matroska',
          ],
          magicBytes: [
            [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], // MP4
            [0x1a, 0x45, 0xdf, 0xa3], // MKV/WebM
          ],
        },
      ],
      // Audio
      [
        'audio',
        {
          extensions: ['.mp3', '.wav', '.ogg', '.m4a', '.aac'],
          mimeTypes: [
            'audio/mpeg',
            'audio/wav',
            'audio/ogg',
            'audio/mp4',
            'audio/aac',
          ],
          magicBytes: [
            [0xff, 0xfb], // MP3
            [0xff, 0xf3], // MP3
            [0xff, 0xf2], // MP3
            [0x52, 0x49, 0x46, 0x46], // WAV (RIFF)
          ],
        },
      ],
    ]);

    // Allow custom file types from config
    const customFileTypes = this.configService.get<string>(
      'storage.allowedFileTypes',
    );
    if (customFileTypes) {
      try {
        const custom = JSON.parse(customFileTypes);
        Object.entries(custom).forEach(([key, value]) => {
          this.allowedFileTypes.set(key, value as FileTypeConfig);
        });
      } catch (_e) {
        // Invalid config, use defaults
      }
    }
  }

  // Extensions that can execute scripts when served from the storage origin.
  // Always rejected, even if runtime config tries to allow them back.
  private static readonly DANGEROUS_EXTENSIONS: ReadonlySet<string> = new Set([
    '.svg', '.html', '.htm', '.xhtml', '.js', '.mjs', '.cjs',
    '.xml', '.swf', '.jar', '.exe', '.bat', '.sh', '.ps1',
    '.cmd', '.dll', '.app', '.apk', '.msi',
  ]);

  /**
   * Validate file extension
   */
  private validateExtension(filename: string): {
    extension: string;
    category: string;
  } {
    const ext = this.getExtension(filename).toLowerCase();

    if (FileValidationService.DANGEROUS_EXTENSIONS.has(ext)) {
      const lang = I18nContext.current()?.lang ?? 'en';
      throw new BadRequestException(
        this.i18n.t('upload.FILE_TYPE_NOT_ALLOWED', { lang, args: { types: ext } }),
      );
    }

    for (const [category, config] of this.allowedFileTypes.entries()) {
      if (config.extensions.includes(ext)) {
        return { extension: ext, category };
      }
    }

    const lang = I18nContext.current()?.lang ?? 'en';
    const types = Array.from(this.allowedFileTypes.values())
      .flatMap((c) => c.extensions)
      .join(', ');
    throw new BadRequestException(
      this.i18n.t('upload.FILE_TYPE_NOT_ALLOWED', { lang, args: { types } }),
    );
  }

  /**
   * Validate MIME type. We accept `application/octet-stream` as a generic
   * fallback (browsers send it), but the magic-byte check is still required
   * downstream so a generic content-type cannot itself bypass validation.
   */
  private validateMimeType(mimeType: string, allowedMimeTypes: string[]): void {
    if (!mimeType) return;
    if (mimeType === 'application/octet-stream') return;
    if (!allowedMimeTypes.includes(mimeType)) {
      const lang = I18nContext.current()?.lang ?? 'en';
      throw new BadRequestException(
        this.i18n.t('upload.MIME_NOT_ALLOWED', { lang, args: { mimeType } }),
      );
    }
  }

  /**
   * Validate file content using magic bytes
   */
  private validateMagicBytes(
    buffer: Buffer,
    allowedMagicBytes: number[][],
  ): boolean {
    if (!allowedMagicBytes || allowedMagicBytes.length === 0) {
      return true; // No magic bytes defined, skip validation
    }

    for (const signature of allowedMagicBytes) {
      if (buffer.length < signature.length) {
        continue;
      }

      let matches = true;
      for (let i = 0; i < signature.length; i++) {
        if (buffer[i] !== signature[i]) {
          matches = false;
          break;
        }
      }

      if (matches) {
        return true;
      }
    }

    return false;
  }

  /**
   * Sanitize filename to prevent path traversal and other attacks
   */
  private sanitizeFilename(filename: string): string {
    // Remove path separators and dangerous characters
    let sanitized = filename
      .replace(/[/\\]/g, '') // Remove path separators
      .replace(/\.\./g, '') // Remove parent directory references
      .replace(/[<>:"|?*]/g, '') // Remove Windows forbidden characters
      .trim();

    // Remove leading dots and spaces
    sanitized = sanitized.replace(/^[.\s]+/, '');

    // Ensure filename is not empty
    if (!sanitized || sanitized.length === 0) {
      sanitized = 'file';
    }

    // Limit filename length
    if (sanitized.length > 255) {
      const ext = this.getExtension(sanitized);
      const nameWithoutExt = sanitized.slice(0, 255 - ext.length);
      sanitized = nameWithoutExt + ext;
    }

    return sanitized;
  }

  /**
   * Get file extension
   */
  private getExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1 || lastDot === filename.length - 1) {
      return '';
    }
    return filename.substring(lastDot);
  }

  /**
   * Main validation method
   */
  validateFile(file: any): { sanitizedOriginalName: string } {
    const lang = I18nContext.current()?.lang ?? 'en';

    if (!file) {
      throw new BadRequestException(this.i18n.t('upload.FILE_REQUIRED', { lang }));
    }

    // 1. Validate file size
    if (file.size > this.maxFileSize) {
      const maxSizeMB = (this.maxFileSize / 1024 / 1024).toFixed(2);
      throw new BadRequestException(
        this.i18n.t('upload.FILE_TOO_LARGE', { lang, args: { maxSizeMB } }),
      );
    }

    // 2. Validate file is not empty
    if (file.size === 0) {
      throw new BadRequestException(this.i18n.t('upload.FILE_EMPTY', { lang }));
    }

    // 3. Sanitize filename
    const sanitizedFilename = this.sanitizeFilename(file.originalname);

    // 4. Validate extension
    const { category } = this.validateExtension(sanitizedFilename);
    const fileTypeConfig = this.allowedFileTypes.get(category)!;

    // 5. Validate MIME type
    if (file.mimetype) {
      this.validateMimeType(file.mimetype, fileTypeConfig.mimeTypes);
    }

    // 6. Validate magic bytes (content validation)
    if (fileTypeConfig.magicBytes && fileTypeConfig.magicBytes.length > 0) {
      const isValidContent = this.validateMagicBytes(
        file.buffer,
        fileTypeConfig.magicBytes,
      );
      if (!isValidContent) {
        throw new BadRequestException(
          this.i18n.t('upload.CONTENT_MISMATCH', { lang }),
        );
      }
    }

    return { sanitizedOriginalName: sanitizedFilename };
  }

  /**
   * Get allowed file types for client
   */
  getAllowedFileTypes(): string[] {
    return Array.from(this.allowedFileTypes.values())
      .flatMap((config) => config.extensions)
      .sort();
  }
}
