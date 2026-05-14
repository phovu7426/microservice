export enum CommentStatus {
  visible = 'visible',
  hidden = 'hidden',
  spam = 'spam',
  deleted = 'deleted',
}

export const CommentStatusOptions = [
  { value: CommentStatus.visible, label: 'Hiển thị' },
  { value: CommentStatus.hidden, label: 'Ẩn' },
  { value: CommentStatus.spam, label: 'Spam' },
  { value: CommentStatus.deleted, label: 'Đã xóa' },
];
