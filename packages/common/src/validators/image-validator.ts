import { BadRequestException } from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';
import { commonMsg } from '../i18n/common-messages';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_FILE_SIZE_MB = 10;
const MAX_FILES = 100;

export class ImageValidator {
  static validate(file: any): void {
    const lang = I18nContext.current()?.lang ?? 'vi';
    if (!file) throw new BadRequestException(commonMsg(lang, 'FILE_REQUIRED'));
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        commonMsg(lang, 'INVALID_FILE_TYPE', {
          mimetype: file.mimetype,
          allowed: ALLOWED_MIME_TYPES.join(', '),
        }),
      );
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        commonMsg(lang, 'FILE_TOO_LARGE', {
          size: (file.size / 1024 / 1024).toFixed(1),
          max: String(MAX_FILE_SIZE_MB),
        }),
      );
    }
  }

  static validateMultiple(files: any[]): void {
    const lang = I18nContext.current()?.lang ?? 'vi';
    if (!files?.length) throw new BadRequestException(commonMsg(lang, 'MIN_FILES_REQUIRED'));
    if (files.length > MAX_FILES) {
      throw new BadRequestException(commonMsg(lang, 'TOO_MANY_FILES', { max: String(MAX_FILES) }));
    }
    for (const file of files) this.validate(file);
  }
}
