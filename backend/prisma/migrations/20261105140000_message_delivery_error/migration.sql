-- Why the platform could not deliver a reply it had already accepted.
ALTER TABLE "messages" ADD COLUMN "delivery_error" TEXT;
