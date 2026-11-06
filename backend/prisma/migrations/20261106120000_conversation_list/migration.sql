-- Conversation list: per-account read positions, customer tags, and indexes for paging.
-- Only adds tables and indexes, so the previous version keeps working against it.

-- How far each account has read a conversation.
CREATE TABLE "chat_room_reads" (
    "account_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "last_read_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_room_reads_pkey" PRIMARY KEY ("account_id","room_id")
);

-- A company's labels for its customers.
CREATE TABLE "customer_tags" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_tags_pkey" PRIMARY KEY ("id")
);

-- Which tags the customer of a conversation has.
CREATE TABLE "chat_room_tags" (
    "room_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_room_tags_pkey" PRIMARY KEY ("room_id","tag_id")
);

CREATE INDEX "chat_room_reads_room_id_idx" ON "chat_room_reads"("room_id");
CREATE UNIQUE INDEX "customer_tags_company_id_name_key" ON "customer_tags"("company_id", "name");
CREATE INDEX "chat_room_tags_tag_id_idx" ON "chat_room_tags"("tag_id");

-- Paging the conversation list and a conversation's messages.
CREATE INDEX "chat_rooms_company_id_updated_at_id_idx" ON "chat_rooms"("company_id", "updated_at" DESC, "id" DESC);
CREATE INDEX "messages_company_id_created_at_id_idx" ON "messages"("company_id", "created_at", "id");
CREATE INDEX "message_recipients_to_chat_room_id_idx" ON "message_recipients" USING GIN ("to_chat_room_id");

ALTER TABLE "chat_room_reads" ADD CONSTRAINT "chat_room_reads_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_room_reads" ADD CONSTRAINT "chat_room_reads_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_room_tags" ADD CONSTRAINT "chat_room_tags_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_room_tags" ADD CONSTRAINT "chat_room_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "customer_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Nobody has a read position yet. Count what came in before this release as read,
-- so every existing conversation doesn't show its whole history as unread.
INSERT INTO "chat_room_reads" ("account_id", "room_id", "last_read_at", "updated_at")
SELECT a."id", r."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "accounts" a
JOIN "chat_rooms" r ON r."company_id" = a."company_id";
