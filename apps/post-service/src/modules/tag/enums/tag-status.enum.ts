export enum TagStatus {
  active = 'active',
  inactive = 'inactive',
}

export const TagStatusOptions = [
  { value: TagStatus.active, label: 'Hoạt động' },
  { value: TagStatus.inactive, label: 'Ngừng hoạt động' },
];
