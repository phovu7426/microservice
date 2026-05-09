import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  Validate,
} from 'class-validator';
import { MatchConstraint } from '../../../auth/dto/register.dto';

export class ChangePasswordDto {
  @IsNotEmpty({ message: 'Old password cannot be empty.' })
  @IsString()
  oldPassword: string;

  @IsNotEmpty({ message: 'Password cannot be empty.' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  @MaxLength(72, { message: 'Password is too long.' })
  password: string;

  @IsNotEmpty({ message: 'Confirm password cannot be empty.' })
  @IsString()
  @Validate(MatchConstraint, ['password'], { message: 'Passwords do not match.' })
  confirmPassword: string;
}
