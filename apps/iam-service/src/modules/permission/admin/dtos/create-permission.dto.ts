import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PermissionScope } from '../../enums/permission-scope.enum';

export class CreatePermissionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Matches(/^[a-z][a-z0-9_.-]{1,119}$/i, {
    message: 'code must start with a letter and contain only letters, digits, underscore, dot, dash.',
  })
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsEnum(PermissionScope)
  scope?: PermissionScope;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'parentId must be numeric.' })
  parentId?: string;
}
