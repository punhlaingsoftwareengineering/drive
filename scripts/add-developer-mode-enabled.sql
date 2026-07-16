-- Shared auth: PHH-DRIVE developer mode flag on canonical Better Auth user table.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS developer_mode_enabled boolean NOT NULL DEFAULT false;
