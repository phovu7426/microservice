import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrimaryKey } from 'src/types';
import { UserAdminRepository } from '../../repositories/user-admin.repository';
import { UpdateProfileDto } from '../dtos/update-profile.dto';
import { ChangePasswordDto } from '../dtos/change-password.dto';

@Injectable()
export class ProfileService {
  constructor(
    private readonly userRepo: UserAdminRepository,
    private readonly config: ConfigService,
  ) {}

  async getProfile(userId: PrimaryKey) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  async updateProfile(userId: PrimaryKey, dto: UpdateProfileDto) {
    await this.getProfile(userId);

    const userData: Record<string, any> = {};
    const profileData: Record<string, any> = {};

    if (dto.name !== undefined) userData.name = dto.name;
    if (dto.image !== undefined) userData.image = dto.image;

    if (dto.birthday !== undefined) profileData.birthday = dto.birthday;
    if (dto.gender !== undefined) profileData.gender = dto.gender;
    if (dto.address !== undefined) profileData.address = dto.address;
    if (dto.countryId !== undefined) profileData.countryId = dto.countryId;
    if (dto.provinceId !== undefined) profileData.provinceId = dto.provinceId;
    if (dto.wardId !== undefined) profileData.wardId = dto.wardId;
    if (dto.about !== undefined) profileData.about = dto.about;

    await this.userRepo.updateWithProfile(userId, userData, profileData);

    return this.getProfile(userId);
  }

  async changePassword(userId: PrimaryKey, dto: ChangePasswordDto) {
    const user = await this.userRepo.findByIdWithPassword(userId);
    if (!user) throw new NotFoundException('User not found.');

    if (!user.password) {
      throw new BadRequestException(
        'Cannot change password for social login accounts.',
      );
    }

    const isMatch = await bcrypt.compare(dto.oldPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('Old password is incorrect.');
    }

    const rounds = Number(this.config.get('BCRYPT_ROUNDS') ?? 12);
    const hashed = await bcrypt.hash(dto.password, rounds);
    await this.userRepo.update(userId, { password: hashed });

    return { success: true };
  }
}
