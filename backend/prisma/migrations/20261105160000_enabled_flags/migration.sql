-- Lets a company admin switch channels and accounts off without deleting them.
ALTER TABLE "company_channels" ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "accounts" ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true;
