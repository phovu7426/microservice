export enum PostStatus {
  draft = 'draft',
  scheduled = 'scheduled',
  published = 'published',
  archived = 'archived',
}

// Public listing only shows posts that are visible right now. Scheduling
// should flip status to `published` when publishedAt arrives, instead of
// leaking future-dated drafts publicly.
export const PUBLIC_POST_STATUSES = [PostStatus.published];
