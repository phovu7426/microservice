export enum NotificationStatus {
  active = 'active',
  archived = 'archived',
  deleted = 'deleted',
}

export const NotificationStatusOptions = [
  { value: NotificationStatus.active, label: 'Hoạt động' },
  { value: NotificationStatus.archived, label: 'Đã lưu trữ' },
  { value: NotificationStatus.deleted, label: 'Đã xóa' },
];
