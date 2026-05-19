-- Migration: remove group_id from categories, tags, posts
-- group_id was a remnant of a removed group-scope feature; it is not read
-- or written by any service code, so dropping it is safe.

DROP INDEX IF EXISTS "categories_idx_group_id";
ALTER TABLE "categories" DROP COLUMN IF EXISTS "group_id";

DROP INDEX IF EXISTS "tags_idx_group_id";
ALTER TABLE "tags" DROP COLUMN IF EXISTS "group_id";

DROP INDEX IF EXISTS "posts_idx_group_id";
ALTER TABLE "posts" DROP COLUMN IF EXISTS "group_id";
