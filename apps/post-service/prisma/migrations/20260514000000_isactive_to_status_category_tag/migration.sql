-- AlterTable: Category — replace is_active (boolean) with status (varchar)
ALTER TABLE "categories" RENAME COLUMN "is_active" TO "status_bool_tmp";
ALTER TABLE "categories" ADD COLUMN "status" VARCHAR(30) NOT NULL DEFAULT 'active';
UPDATE "categories" SET "status" = CASE WHEN "status_bool_tmp" = true THEN 'active' ELSE 'inactive' END;
ALTER TABLE "categories" DROP COLUMN "status_bool_tmp";

-- AlterTable: Tag — replace is_active (boolean) with status (varchar)
ALTER TABLE "tags" RENAME COLUMN "is_active" TO "status_bool_tmp";
ALTER TABLE "tags" ADD COLUMN "status" VARCHAR(30) NOT NULL DEFAULT 'active';
UPDATE "tags" SET "status" = CASE WHEN "status_bool_tmp" = true THEN 'active' ELSE 'inactive' END;
ALTER TABLE "tags" DROP COLUMN "status_bool_tmp";

-- DropIndex
DROP INDEX IF EXISTS "categories_idx_is_active";
DROP INDEX IF EXISTS "tags_idx_is_active";

-- CreateIndex
CREATE INDEX "categories_idx_status" ON "categories"("status");
CREATE INDEX "tags_idx_status" ON "tags"("status");
