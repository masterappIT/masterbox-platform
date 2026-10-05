ALTER TABLE "platform_admin_profiles"
  ADD COLUMN "display_name" TEXT NOT NULL DEFAULT 'Platform Admin',
  ADD COLUMN "mobile" TEXT,
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "last_login_at" TIMESTAMP(3);
CREATE INDEX "platform_admin_profiles_is_active_idx" ON "platform_admin_profiles"("is_active");
