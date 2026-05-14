export enum ChapterStatus {
  draft = 'draft',
  published = 'published',
  scheduled = 'scheduled',
}

export const PUBLIC_CHAPTER_STATUSES = [ChapterStatus.published, ChapterStatus.scheduled];

export const ChapterStatusOptions = [
  { value: ChapterStatus.draft, label: 'Nháp' },
  { value: ChapterStatus.published, label: 'Đã xuất bản' },
  { value: ChapterStatus.scheduled, label: 'Lên lịch' },
];
