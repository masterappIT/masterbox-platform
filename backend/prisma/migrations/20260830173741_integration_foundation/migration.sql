-- Production integration credentials and tenant-scoped conversation storage
CREATE TABLE "third_party_integrations" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "app_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "api_key_hash" TEXT NOT NULL,
  "api_key_prefix" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "last_used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "third_party_integrations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "third_party_integrations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "third_party_integrations_app_id_key" ON "third_party_integrations"("app_id");
CREATE INDEX "third_party_integrations_company_id_idx" ON "third_party_integrations"("company_id");

CREATE TABLE "integration_conversations" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "integration_id" TEXT NOT NULL,
  "external_id" TEXT NOT NULL,
  "subject" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "integration_conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "integration_conversations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "integration_conversations_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "third_party_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "integration_conversations_integration_id_external_id_key" ON "integration_conversations"("integration_id", "external_id");
CREATE INDEX "integration_conversations_company_id_updated_at_idx" ON "integration_conversations"("company_id", "updated_at");

CREATE TABLE "integration_messages" (
  "id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "external_id" TEXT,
  "direction" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integration_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "integration_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "integration_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "integration_messages_conversation_id_external_id_key" ON "integration_messages"("conversation_id", "external_id");
CREATE INDEX "integration_messages_conversation_id_created_at_idx" ON "integration_messages"("conversation_id", "created_at");

CREATE TABLE "deep_link_sessions" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "integration_id" TEXT NOT NULL,
  "conversation_id" TEXT,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "deep_link_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "deep_link_sessions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "deep_link_sessions_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "third_party_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "deep_link_sessions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "integration_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "deep_link_sessions_token_hash_key" ON "deep_link_sessions"("token_hash");
CREATE INDEX "deep_link_sessions_company_id_expires_at_idx" ON "deep_link_sessions"("company_id", "expires_at");
