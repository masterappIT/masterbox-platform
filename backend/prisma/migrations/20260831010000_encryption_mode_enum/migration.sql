-- CreateEnum
CREATE TYPE "EncryptionMode" AS ENUM ('server', 'e2ee');

-- Convert the existing text column to the Prisma enum.
ALTER TABLE "messages"
  ALTER COLUMN "encryption_mode" DROP DEFAULT,
  ALTER COLUMN "encryption_mode" TYPE "EncryptionMode" USING "encryption_mode"::"EncryptionMode",
  ALTER COLUMN "encryption_mode" SET DEFAULT 'server';
