export enum NotificationType {
  info = 'info',
  success = 'success',
  warning = 'warning',
  error = 'error',
}

export const NotificationTypeOptions = [
  { value: NotificationType.info, label: 'Thông tin' },
  { value: NotificationType.success, label: 'Thành công' },
  { value: NotificationType.warning, label: 'Cảnh báo' },
  { value: NotificationType.error, label: 'Lỗi' },
];
