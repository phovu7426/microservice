import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrimaryKey } from 'src/types';
import { UserAdminRepository } from '../../repositories/user-admin.repository';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { AdminChangePasswordDto } from '../dtos/admin-change-password.dto';
import { ChangeStatusDto } from '../dtos/change-status.dto';
import { UserQueryDto } from '../dtos/user-query.dto';

@Injectable()
export class AdminUserService {
  constructor(
    private readonly userRepo: UserAdminRepository,
    private readonly configService: ConfigService,
  ) {}

  async getList(query: UserQueryDto) {
    return this.userRepo.findAll(query);
  }

  async getSimpleList(query: UserQueryDto) {
    return this.userRepo.findAllSimple(query);
  }

  async getOne(id: PrimaryKey) {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.sanitize(user);
  }

  async create(dto: CreateUserDto, actorId?: PrimaryKey) {
    await this.assertUnique({
      email: dto.email,
      username: dto.username,
      phone: dto.phone,
    });

    const rounds = this.configService.get<number>('BCRYPT_ROUNDS', 12);
    const hashedPassword = await bcrypt.hash(dto.password, rounds);

    const { profile: profileDto, ...rest } = dto;
    const profileData = profileDto
      ? this.buildProfileData(profileDto, actorId)
      : undefined;

    const user = await this.userRepo.createWithProfile(
      { ...rest, password: hashedPassword, createdUserId: actorId, updatedUserId: actorId },
      profileData,
    );

    return this.getOne(user.id);
  }

  async update(id: bigint, dto: UpdateUserDto, actorId?: PrimaryKey) {
    await this.getOne(id);

    await this.assertUnique(
      { email: dto.email, username: dto.username, phone: dto.phone },
      id,
    );

    const { profile: profileDto, password, ...rest } = dto;
    const updateData: Record<string, any> = { ...rest, updatedUserId: actorId };

    if (password) {
      const rounds = this.configService.get<number>('BCRYPT_ROUNDS', 12);
      updateData.password = await bcrypt.hash(password, rounds);
    }

    const profileData = profileDto
      ? this.buildProfileData(profileDto, actorId)
      : undefined;

    await this.userRepo.updateWithProfile(id, updateData, profileData);

    return this.getOne(id);
  }

  async delete(id: PrimaryKey) {
    await this.getOne(id);
    await this.userRepo.delete(id);
    return { success: true };
  }

  async changePassword(id: PrimaryKey, dto: AdminChangePasswordDto) {
    await this.getOne(id);
    const rounds = this.configService.get<number>('BCRYPT_ROUNDS', 12);
    const hashedPassword = await bcrypt.hash(dto.password, rounds);
    await this.userRepo.update(id, { password: hashedPassword });
    return { success: true };
  }

  async changeStatus(id: PrimaryKey, dto: ChangeStatusDto) {
    await this.getOne(id);
    await this.userRepo.update(id, { status: dto.status });
    return { success: true };
  }

  private async assertUnique(
    fields: { email?: string; username?: string; phone?: string },
    excludeId?: PrimaryKey,
  ) {
    const conflict = await this.userRepo.checkUnique(fields, excludeId);
    if (conflict) {
      throw new BadRequestException(
        `${conflict.field} "${conflict.value}" is already taken`,
      );
    }
  }

  private buildProfileData(
    profile: Record<string, any>,
    actorId?: PrimaryKey,
  ): Record<string, any> {
    const data: Record<string, any> = { ...profile };
    if (actorId) {
      data.createdUserId = actorId;
      data.updatedUserId = actorId;
    }
    return data;
  }

  private sanitize(user: Record<string, any>) {
    const { password, rememberToken, ...rest } = user;
    return rest;
  }
}
