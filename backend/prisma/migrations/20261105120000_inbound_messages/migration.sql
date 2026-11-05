-- Customer messages from a platform webhook have no creating account.
ALTER TABLE "messages" ALTER COLUMN "created_by" DROP NOT NULL;

-- The platform's message id, so webhook retries are not stored twice.
ALTER TABLE "messages" ADD COLUMN "external_id" TEXT;
CREATE UNIQUE INDEX "messages_external_id_key" ON "messages"("external_id");
