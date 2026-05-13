import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { CertificateType } from '../../enums/certificate-type.enum';
import { BasicStatus } from '../../../../common/enums/status.enum';

const URL_OPTS = { require_protocol: true, protocols: ['http', 'https'] };

export class CreateCertificateDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsUrl(URL_OPTS, { message: 'image must be an http(s) URL.' })
  @MaxLength(500)
  image?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  issuedBy?: string;

  @IsOptional()
  @IsDateString()
  issuedDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  certificateNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsEnum(CertificateType)
  type?: CertificateType;

  @IsOptional()
  @IsEnum(BasicStatus)
  status?: BasicStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
