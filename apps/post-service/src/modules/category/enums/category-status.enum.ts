export enum CategoryStatus {
  active = 'active',
  inactive = 'inactive',
}

export const CategoryStatusOptions = [
  { value: CategoryStatus.active, label: 'Hoạt động' },
  { value: CategoryStatus.inactive, label: 'Ngừng hoạt động' },
];
