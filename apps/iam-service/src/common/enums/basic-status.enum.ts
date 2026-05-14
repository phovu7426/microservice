export enum BasicStatus {
  active = 'active',
  inactive = 'inactive',
}

export const BasicStatusOptions = [
  { value: BasicStatus.active, label: 'Hoạt động' },
  { value: BasicStatus.inactive, label: 'Ngừng hoạt động' },
];
