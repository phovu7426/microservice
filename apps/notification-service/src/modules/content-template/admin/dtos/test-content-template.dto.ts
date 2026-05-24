import { IsEmail, IsObject, IsOptional } from 'class-validator';

export class TestContentTemplateDto {
  @IsEmail()
  to: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;
}
