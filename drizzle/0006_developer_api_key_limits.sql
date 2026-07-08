ALTER TABLE "developer_api_key" ADD COLUMN IF NOT EXISTS "max_teams" integer;
ALTER TABLE "developer_api_key" ADD COLUMN IF NOT EXISTS "max_folders" integer;
ALTER TABLE "developer_api_key" ADD COLUMN IF NOT EXISTS "max_files" integer;

ALTER TABLE "team" ADD COLUMN IF NOT EXISTS "created_by_api_key_id" uuid;

ALTER TABLE "main_file" ADD COLUMN IF NOT EXISTS "created_by_api_key_id" uuid;

CREATE INDEX IF NOT EXISTS "team_created_by_api_key_id_idx" ON "team" ("created_by_api_key_id");
CREATE INDEX IF NOT EXISTS "main_file_created_by_api_key_id_idx" ON "main_file" ("created_by_api_key_id");
