ALTER TABLE "ResellerOrganization"
  ADD COLUMN IF NOT EXISTS "orderingEnabled" BOOLEAN NOT NULL DEFAULT false;
