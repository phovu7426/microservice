export interface ChapterPublishedEvent {
  comic_id: string;
  chapter_id: string;
  comic_title: string;
  chapter_label: string;
  published_at: string;
}

export const CHAPTER_PUBLISHED_TOPIC = 'comic.chapter.published';
