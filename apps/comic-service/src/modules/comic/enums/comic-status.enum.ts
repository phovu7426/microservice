export enum ComicStatus {
  draft = 'draft',
  published = 'published',
  scheduled = 'scheduled',
}

// Public listing only shows comics that are actually visible right now.
// `scheduled` previously leaked future-dated content publicly; the
// scheduling flow should flip status to `published` when the time arrives.
export const PUBLIC_COMIC_STATUSES = [ComicStatus.published];

export const ComicStatusOptions = [
  { value: ComicStatus.draft, label: 'Nháp' },
  { value: ComicStatus.published, label: 'Đã xuất bản' },
  { value: ComicStatus.scheduled, label: 'Lên lịch' },
];
