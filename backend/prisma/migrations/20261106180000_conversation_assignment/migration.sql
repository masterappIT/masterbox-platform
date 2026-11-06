-- Conversation assignment: which agent handles a conversation.
-- Only adds nullable columns and an index, so every existing conversation starts unassigned,
-- no row is rewritten, and the previous version keeps working against it.
ALTER TABLE "chat_rooms" ADD COLUMN "assignee_id" TEXT,
ADD COLUMN "assigned_at" TIMESTAMP(3);

CREATE INDEX "chat_rooms_assignee_id_idx" ON "chat_rooms"("assignee_id");

-- Deleting an account leaves its conversations unassigned rather than deleting them.
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
