export enum BannerStatus {
  draft = 'draft',
  active = 'active',
  inactive = 'inactive',
}

export enum BannerLinkTarget {
  self = '_self',
  blank = '_blank',
}

export const BannerStatusOptions = [
  { value: BannerStatus.draft, label: 'Nháp' },
  { value: BannerStatus.active, label: 'Hoạt động' },
  { value: BannerStatus.inactive, label: 'Ngừng hoạt động' },
];

export const BannerLinkTargetOptions = [
  { value: BannerLinkTarget.self, label: 'Cùng tab' },
  { value: BannerLinkTarget.blank, label: 'Tab mới' },
];
