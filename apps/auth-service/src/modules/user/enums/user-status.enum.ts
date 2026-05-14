export enum UserStatus {
  active = 'active',
  inactive = 'inactive',
  locked = 'locked',
}

export const UserStatusOptions = [
  { value: UserStatus.active, label: 'Hoạt động' },
  { value: UserStatus.inactive, label: 'Ngừng hoạt động' },
  { value: UserStatus.locked, label: 'Đã khóa' },
];
