DO $$
BEGIN
  CREATE TYPE "ResellerOrganizationStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ResellerTier" AS ENUM ('TIER_1', 'TIER_2');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ResellerMemberRole" AS ENUM ('OWNER', 'MEMBER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ResellerOrganization" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" "ResellerOrganizationStatus" NOT NULL DEFAULT 'PENDING',
  "tier" "ResellerTier" NOT NULL DEFAULT 'TIER_1',
  "rejectionReason" TEXT,
  "suspendedAt" TIMESTAMP(3),
  "suspendedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResellerOrganization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ResellerOrganizationMember" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "ResellerMemberRole" NOT NULL DEFAULT 'MEMBER',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResellerOrganizationMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ResellerOrganization_slug_key"
  ON "ResellerOrganization"("slug");
CREATE INDEX IF NOT EXISTS "ResellerOrganization_status_createdAt_idx"
  ON "ResellerOrganization"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "ResellerOrganization_tier_status_idx"
  ON "ResellerOrganization"("tier", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "ResellerOrganizationMember_organizationId_userId_key"
  ON "ResellerOrganizationMember"("organizationId", "userId");
CREATE INDEX IF NOT EXISTS "ResellerOrganizationMember_userId_active_idx"
  ON "ResellerOrganizationMember"("userId", "active");
CREATE INDEX IF NOT EXISTS "ResellerOrganizationMember_organizationId_active_idx"
  ON "ResellerOrganizationMember"("organizationId", "active");
CREATE INDEX IF NOT EXISTS "ResellerOrganizationMember_organizationId_role_idx"
  ON "ResellerOrganizationMember"("organizationId", "role");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ResellerOrganizationMember_organizationId_fkey'
  ) THEN
    ALTER TABLE "ResellerOrganizationMember"
      ADD CONSTRAINT "ResellerOrganizationMember_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "ResellerOrganization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ResellerOrganizationMember_userId_fkey'
  ) THEN
    ALTER TABLE "ResellerOrganizationMember"
      ADD CONSTRAINT "ResellerOrganizationMember_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
