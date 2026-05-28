import { Injectable } from '@nestjs/common';
import { BannerLocationRepository } from '../../repositories/banner-location.repository';

@Injectable()
export class PublicBannerLocationService {
  constructor(private readonly locationRepo: BannerLocationRepository) {}

  getOptions() {
    return this.locationRepo.findOptions();
  }
}
