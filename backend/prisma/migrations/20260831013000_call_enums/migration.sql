CREATE TYPE "public"."CallKind" AS ENUM ('voice', 'video');
CREATE TYPE "public"."CallStatus" AS ENUM ('ringing', 'active', 'ended', 'declined', 'missed');
ALTER TABLE "call_sessions" ALTER COLUMN "kind" TYPE "public"."CallKind" USING ("kind"::text::"public"."CallKind");
ALTER TABLE "call_sessions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "call_sessions" ALTER COLUMN "status" TYPE "public"."CallStatus" USING ("status"::text::"public"."CallStatus");
ALTER TABLE "call_sessions" ALTER COLUMN "status" SET DEFAULT 'ringing';
