import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { I18nService } from 'nestjs-i18n';
import { CrudService, getSessionUserId, t, buildSearchText } from '@package/common';
import { PrimaryKey } from 'src/types';
import { UserAdminRepository } from '../../repositories/user-admin.repository';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { AdminChangePasswordDto } from '../dtos/admin-change-password.dto';
import { ChangeStatusDto } from '../dtos/change-status.dto';

@Injectable()
export class AdminUserService extends CrudService<UserAdminRepository> {
  constructor(
    private readonly userRepo: UserAdminRepository,
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
  ) {
    super(userRepo);
  }

  async getOne(id: any): Promise<any> {
    const entity = await this.userRepo.findById(id);
    if (!entity) throw new NotFoundException(t(this.i18n, 'auth.USER_NOT_FOUND'));
    return this.transform(entity);
  }

  protected transform(entity: any) {
    if (!entity) return entity;
    const { password, rememberToken, ...rest } = entity;
    return rest;
  }

  async create(dto: CreateUserDto) {
    await this.assertUnique({
      email: dto.email,
      username: dto.username,
      phone: dto.phone,
    });

    const rounds = this.configService.get<number>('BCRYPT_ROUNDS', 12);
    const hashedPassword = await bcrypt.hash(dto.password, rounds);

    const actorId = getSessionUserId();
    const { profile: profileDto, ...rest } = dto;
    const profileData = profileDto
      ? this.buildProfileData(profileDto)
      : undefined;

    const user = await this.userRepo.createWithProfile(
      {
        ...rest,
        password: hashedPassword,
        createdUserId: actorId,
        updatedUserId: actorId,
        searchText: buildSearchText(rest.name, rest.email, rest.username, rest.phone),
      },
      profileData,
    );

    return this.getOne(user.id);
  }

  async update(id: bigint, dto: UpdateUserDto) {
    const current = await this.getOne(id);

    await this.assertUnique(
      { email: dto.email, username: dto.username, phone: dto.phone },
      id,
    );

    const { profile: profileDto, password, ...rest } = dto;
    const updateData: Record<string, any> = { ...rest, updatedUserId: getSessionUserId() };

    if (password) {
      const rounds = this.configService.get<number>('BCRYPT_ROUNDS', 12);
      updateData.password = await bcrypt.hash(password, rounds);
    }

    // Recompute searchText từ giá trị merged (current + fields mới)
    const merged = { ...current, ...rest };
    updateData.searchText = buildSearchText(merged.name, merged.email, merged.username, merged.phone);

    const profileData = profileDto ? this.buildProfileData(profileDto) : undefined;

    await this.userRepo.updateWithProfile(id, updateData, profileData);
    return this.getOne(id);
  }

  async delete(id: PrimaryKey) {
    await this.getOne(id);
    await this.userRepo.delete(id);
    return { success: true, message: t(this.i18n, 'auth.USER_DELETED') };
  }

  async changePassword(id: PrimaryKey, dto: AdminChangePasswordDto) {
    await this.getOne(id);
    const rounds = this.configService.get<number>('BCRYPT_ROUNDS', 12);
    const hashedPassword = await bcrypt.hash(dto.password, rounds);
    await this.userRepo.update(id, { password: hashedPassword });
    return { success: true, message: t(this.i18n, 'auth.PASSWORD_CHANGED') };
  }

  async changeStatus(id: PrimaryKey, dto: ChangeStatusDto) {
    await this.getOne(id);
    await this.userRepo.update(id, { status: dto.status });
    return { success: true, message: t(this.i18n, 'auth.STATUS_CHANGED') };
  }

  private async assertUnique(
    fields: { email?: string; username?: string; phone?: string },
    excludeId?: PrimaryKey,
  ) {
    const conflict = await this.userRepo.checkUnique(fields, excludeId);
    if (conflict) {
      const keyMap: Record<string, string> = {
        email: 'auth.EMAIL_IN_USE',
        username: 'auth.USERNAME_IN_USE',
        phone: 'auth.PHONE_IN_USE',
      };
      throw new BadRequestException(t(this.i18n, keyMap[conflict.field] ?? 'auth.EMAIL_IN_USE'));
    }
  }

  private buildProfileData(profile: Record<string, any>): Record<string, any> {
    const data: Record<string, any> = { ...profile };
    const actorId = getSessionUserId();
    if (actorId) {
      data.createdUserId = actorId;
      data.updatedUserId = actorId;
    }
    return data;
  }
}
