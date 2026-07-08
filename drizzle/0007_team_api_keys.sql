ALTER TABLE "developer_api_key" ADD COLUMN IF NOT EXISTS "team_id" uuid;
ALTER TABLE "developer_api_key" ADD COLUMN IF NOT EXISTS "permissions" jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS "developer_api_key_team_id_idx" ON "developer_api_key" ("team_id");
