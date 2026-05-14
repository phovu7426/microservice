export enum ContactStatus {
  pending = 'Pending',
  read = 'Read',
  replied = 'Replied',
  closed = 'Closed',
}

export const ContactStatusOptions = [
  { value: ContactStatus.pending, label: 'Chờ xử lý' },
  { value: ContactStatus.read, label: 'Đã đọc' },
  { value: ContactStatus.replied, label: 'Đã trả lời' },
  { value: ContactStatus.closed, label: 'Đã đóng' },
];
