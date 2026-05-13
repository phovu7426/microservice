import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TemplateType } from '../../enums/template-type.enum';
import { TemplateCategory } from '../../enums/template-category.enum';

export class CreateContentTemplateDto {
  // `code` is referenced by `mail.send` events — keep it strict so an
  // attacker who lands on this endpoint can't smuggle weird control chars
  // that confuse the consumer-side allowlist.
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{1,99}$/, {
    message: 'code must be lowercase alphanumeric + underscore.',
  })
  @MaxLength(100)
  code: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsEnum(TemplateCategory)
  category?: TemplateCategory;

  @IsEnum(TemplateType)
  type: TemplateType;

  @IsOptional()
  @IsString()
  // Cap content at 200KB. Unbounded TEXT was a DoS surface (admins can
  // store huge payloads, then the rendered output is sent over SMTP).
  @MaxLength(200_000)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  filePath?: string;

  // `metadata` typically holds `subject` etc.; constrain to an object so
  // callers can't dump huge arrays / scalars here.
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;
}
