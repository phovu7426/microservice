import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

const toBool = ({ value }: { value: any }) =>
  value === true || value === 'true' || value === '1' || value === 1;

// Valid SMTP host: hostname or IP, no protocol/path. Blocks SSRF tricks like
// embedded URLs and rejects obvious metadata endpoints in user input.
const SMTP_HOST_RE = /^(?!169\.254\.|0\.|127\.|10\.|192\.168\.)[A-Za-z0-9._-]{1,253}$/;

export class UpdateEmailConfigDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  @Matches(SMTP_HOST_RE, { message: 'smtpHost must be a public hostname.' })
  smtpHost?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(65535)
  @Type(() => Number)
  smtpPort?: number;

  @IsBoolean()
  @IsOptional()
  @Transform(toBool)
  smtpSecure?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  smtpUsername?: string;

  @IsString()
  @IsOptional()
  @MinLength(6)
  @MaxLength(500)
  smtpPassword?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(255)
  fromEmail?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  fromName?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(255)
  replyToEmail?: string;
}
