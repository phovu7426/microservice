import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrimaryKey } from 'src/types';
import { CreateCertificateDto } from '../dtos/create-certificate.dto';
import { UpdateCertificateDto } from '../dtos/update-certificate.dto';
import { createPaginationMeta, parseQueryOptions } from '@package/common';
import { RedisService } from '@package/redis';
import { CertificateFilter, CertificateRepository } from '../../repositories/certificate.repository';

@Injectable()
export class AdminCertificateService {
  constructor(
    private readonly certificateRepo: CertificateRepository,
    @Optional() private readonly redis?: RedisService,
  ) {}

  private async clearCache(id?: any) {
    await this.redis?.del('introduction:public:certificate:list').catch(() => {});
    if (id !== undefined) {
      await this.redis?.del(`introduction:public:certificate:detail:${id}`).catch(() => {});
    }
  }

  async getList(query: any = {}) {
    const options = parseQueryOptions(query);

    const filter: CertificateFilter = {};
    if (query.search) filter.search = query.search;
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;

    const skipCount = query.skipCount === true || query.skipCount === 'true';
    const [data, total] = await Promise.all([
      this.certificateRepo.findMany(filter, options),
      skipCount ? Promise.resolve(0) : this.certificateRepo.count(filter),
    ]);

    return { data, meta: createPaginationMeta(options, total) };
  }

  async getOne(id: PrimaryKey) {
    const item = await this.certificateRepo.findById(id);
    if (!item) throw new NotFoundException('Certificate not found');
    return item;
  }

  async create(dto: CreateCertificateDto) {
    const result = await this.certificateRepo.create({
      name: dto.name,
      image: dto.image,
      issuedBy: dto.issuedBy,
      issuedDate: dto.issuedDate,
      expiryDate: dto.expiryDate,
      certificateNumber: dto.certificateNumber,
      description: dto.description,
      type: dto.type,
      status: dto.status || 'active',
      sortOrder: dto.sortOrder ?? 0,
    });
    await this.clearCache();
    return result;
  }

  async update(id: PrimaryKey, dto: UpdateCertificateDto) {
    await this.getOne(id);
    const result = await this.certificateRepo.update(id, {
      name: dto.name,
      image: dto.image,
      issuedBy: dto.issuedBy,
      issuedDate: dto.issuedDate,
      expiryDate: dto.expiryDate,
      certificateNumber: dto.certificateNumber,
      description: dto.description,
      type: dto.type,
      status: dto.status,
      sortOrder: dto.sortOrder,
    });
    await this.clearCache(id);
    return result;
  }

  async delete(id: PrimaryKey) {
    await this.getOne(id);
    await this.certificateRepo.delete(id);
    await this.clearCache(id);
    return { success: true };
  }
}
