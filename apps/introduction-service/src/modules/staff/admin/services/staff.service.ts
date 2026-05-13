import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrimaryKey } from 'src/types';
import { CreateStaffDto } from '../dtos/create-staff.dto';
import { UpdateStaffDto } from '../dtos/update-staff.dto';
import { createPaginationMeta, parseQueryOptions } from '@package/common';
import { RedisService } from '@package/redis';
import { StaffFilter, StaffRepository } from '../../repositories/staff.repository';

@Injectable()
export class AdminStaffService {
  constructor(
    private readonly staffRepo: StaffRepository,
    @Optional() private readonly redis?: RedisService,
  ) {}

  private async clearCache(id?: any) {
    await this.redis?.del('introduction:public:staff:list').catch(() => {});
    if (id !== undefined) {
      await this.redis?.del(`introduction:public:staff:detail:${id}`).catch(() => {});
    }
  }

  async getList(query: any = {}) {
    const options = parseQueryOptions(query);

    const filter: StaffFilter = {};
    if (query.search) filter.search = query.search;
    if (query.status) filter.status = query.status;
    if (query.department) filter.department = query.department;

    const skipCount = query.skipCount === true || query.skipCount === 'true';
    const [data, total] = await Promise.all([
      this.staffRepo.findMany(filter, options),
      skipCount ? Promise.resolve(0) : this.staffRepo.count(filter),
    ]);

    return { data, meta: createPaginationMeta(options, total) };
  }

  async getOne(id: PrimaryKey) {
    const item = await this.staffRepo.findById(id);
    if (!item) throw new NotFoundException('Staff not found');
    return item;
  }

  async create(dto: CreateStaffDto) {
    const result = await this.staffRepo.create({
      name: dto.name,
      position: dto.position,
      department: dto.department,
      bio: dto.bio,
      avatar: dto.avatar,
      email: dto.email,
      phone: dto.phone,
      socialLinks: dto.socialLinks ?? {},
      experience: dto.experience,
      expertise: dto.expertise,
      status: dto.status || 'active',
      sortOrder: dto.sortOrder ?? 0,
    });
    await this.clearCache();
    return result;
  }

  async update(id: PrimaryKey, dto: UpdateStaffDto) {
    await this.getOne(id);
    const result = await this.staffRepo.update(id, {
      name: dto.name,
      position: dto.position,
      department: dto.department,
      bio: dto.bio,
      avatar: dto.avatar,
      email: dto.email,
      phone: dto.phone,
      socialLinks: dto.socialLinks,
      experience: dto.experience,
      expertise: dto.expertise,
      status: dto.status,
      sortOrder: dto.sortOrder,
    });
    await this.clearCache(id);
    return result;
  }

  async delete(id: PrimaryKey) {
    await this.getOne(id);
    await this.staffRepo.delete(id);
    await this.clearCache(id);
    return { success: true };
  }
}
