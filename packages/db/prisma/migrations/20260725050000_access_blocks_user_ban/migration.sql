-- User local ban fields
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bannedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "banReason" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bannedBy" TEXT;

-- Access blocks (email / IP / clerk / user)
DO $$ BEGIN
  CREATE TYPE "AccessBlockKind" AS ENUM ('EMAIL', 'IP', 'CLERK_ID', 'USER_ID');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "AccessBlock" (
  "id" TEXT NOT NULL,
  "kind" "AccessBlockKind" NOT NULL,
  "value" TEXT NOT NULL,
  "reason" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "revokedBy" TEXT,
  CONSTRAINT "AccessBlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AccessBlock_kind_value_key" ON "AccessBlock"("kind", "value");
CREATE INDEX IF NOT EXISTS "AccessBlock_active_kind_value_idx" ON "AccessBlock"("active", "kind", "value");
CREATE INDEX IF NOT EXISTS "AccessBlock_createdAt_idx" ON "AccessBlock"("createdAt");
