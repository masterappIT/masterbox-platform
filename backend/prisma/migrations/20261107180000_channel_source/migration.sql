-- Unified chat, phase 1: each channel says which source it is, and each conversation has a status.
-- Only adds columns, so the previous version keeps working against it.

CREATE TYPE "ChannelSource" AS ENUM ('messenger', 'instagram', 'whatsapp_cloud', 'whatsapp_web', 'line', 'masterbox');
ALTER TABLE "company_channels" ADD COLUMN "source" "ChannelSource";

-- Existing channels by their platform. WhatsApp numbers connected by QR code have provider 'web' in access_info,
-- the same test as isWebChannel(); the rest of WhatsApp is the Cloud API. WeChat has no source yet and stays null.
-- Only rows without a source are touched, so running it again (as the tests do) changes nothing that is set.
UPDATE "company_channels" SET "source" = (CASE
  WHEN "platform" = 'fb' THEN 'messenger'
  WHEN "platform" = 'ig' THEN 'instagram'
  WHEN "platform" = 'whatsapp' AND "access_info"->>'provider' = 'web' THEN 'whatsapp_web'
  WHEN "platform" = 'whatsapp' THEN 'whatsapp_cloud'
  WHEN "platform" = 'line' THEN 'line'
END)::"ChannelSource"
WHERE "source" IS NULL;

CREATE INDEX "company_channels_company_id_source_idx" ON "company_channels"("company_id", "source");

-- Every existing conversation starts open; no screen changes it yet.
CREATE TYPE "ChatRoomStatus" AS ENUM ('open', 'pending', 'closed');
ALTER TABLE "chat_rooms" ADD COLUMN "status" "ChatRoomStatus" NOT NULL DEFAULT 'open';
