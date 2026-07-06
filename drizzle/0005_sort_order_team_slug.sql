ALTER TABLE "main_file" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL;

ALTER TABLE "team" ADD COLUMN IF NOT EXISTS "slug" text;

UPDATE "team"
SET "slug" = lower(regexp_replace(trim("name"), '[^a-zA-Z0-9]+', '-', 'g'))
WHERE "slug" IS NULL OR trim("slug") = '';

UPDATE "team" SET "slug" = 'team' WHERE "slug" IS NULL OR trim("slug") = '';

CREATE UNIQUE INDEX IF NOT EXISTS "team_slug_uidx" ON "team" ("slug");
