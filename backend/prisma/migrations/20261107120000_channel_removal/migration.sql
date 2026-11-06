-- Removing a channel from 社群平台管理 keeps its conversations, so connecting the same account again brings them back.
-- Only adds a column, so the previous version keeps working against it.
ALTER TABLE "company_channels" ADD COLUMN "deleted_at" TIMESTAMP(3);
