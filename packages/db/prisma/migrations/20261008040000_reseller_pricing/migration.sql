DO $$
BEGIN
  CREATE TYPE "ResellerPriceMode" AS ENUM ('MARKUP', 'FIXED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ResellerTierSkuPrice" (
  "id" TEXT NOT NULL,
  "tier" "ResellerTier" NOT NULL,
  "variantId" TEXT NOT NULL,
  "mode" "ResellerPriceMode" NOT NULL,
  "markupMicros" INTEGER,
  "fixedPriceIDR" INTEGER,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "provenance" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResellerTierSkuPrice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ResellerTierSkuPrice_mode_xor_check" CHECK (
    ("mode" = 'MARKUP' AND "markupMicros" IS NOT NULL AND "fixedPriceIDR" IS NULL)
    OR ("mode" = 'FIXED' AND "markupMicros" IS NULL AND "fixedPriceIDR" IS NOT NULL)
  ),
  CONSTRAINT "ResellerTierSkuPrice_markup_range_check" CHECK ("markupMicros" IS NULL OR ("markupMicros" >= 0 AND "markupMicros" <= 100000000)),
  CONSTRAINT "ResellerTierSkuPrice_fixed_range_check" CHECK ("fixedPriceIDR" IS NULL OR ("fixedPriceIDR" > 0 AND "fixedPriceIDR" < 2147483647)),
  CONSTRAINT "ResellerTierSkuPrice_revision_check" CHECK ("revision" > 0)
);

CREATE TABLE IF NOT EXISTS "ResellerOrganizationSkuPrice" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "mode" "ResellerPriceMode" NOT NULL,
  "markupMicros" INTEGER,
  "fixedPriceIDR" INTEGER,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "provenance" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResellerOrganizationSkuPrice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ResellerOrganizationSkuPrice_mode_xor_check" CHECK (
    ("mode" = 'MARKUP' AND "markupMicros" IS NOT NULL AND "fixedPriceIDR" IS NULL)
    OR ("mode" = 'FIXED' AND "markupMicros" IS NULL AND "fixedPriceIDR" IS NOT NULL)
  ),
  CONSTRAINT "ResellerOrganizationSkuPrice_markup_range_check" CHECK ("markupMicros" IS NULL OR ("markupMicros" >= 0 AND "markupMicros" <= 100000000)),
  CONSTRAINT "ResellerOrganizationSkuPrice_fixed_range_check" CHECK ("fixedPriceIDR" IS NULL OR ("fixedPriceIDR" > 0 AND "fixedPriceIDR" < 2147483647)),
  CONSTRAINT "ResellerOrganizationSkuPrice_revision_check" CHECK ("revision" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "ResellerTierSkuPrice_tier_variantId_key" ON "ResellerTierSkuPrice"("tier", "variantId");
CREATE INDEX IF NOT EXISTS "ResellerTierSkuPrice_variantId_idx" ON "ResellerTierSkuPrice"("variantId");
CREATE UNIQUE INDEX IF NOT EXISTS "ResellerOrganizationSkuPrice_organizationId_variantId_key" ON "ResellerOrganizationSkuPrice"("organizationId", "variantId");
CREATE INDEX IF NOT EXISTS "ResellerOrganizationSkuPrice_variantId_idx" ON "ResellerOrganizationSkuPrice"("variantId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ResellerTierSkuPrice_variantId_fkey') THEN
    ALTER TABLE "ResellerTierSkuPrice" ADD CONSTRAINT "ResellerTierSkuPrice_variantId_fkey"
      FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ResellerOrganizationSkuPrice_organizationId_fkey') THEN
    ALTER TABLE "ResellerOrganizationSkuPrice" ADD CONSTRAINT "ResellerOrganizationSkuPrice_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "ResellerOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ResellerOrganizationSkuPrice_variantId_fkey') THEN
    ALTER TABLE "ResellerOrganizationSkuPrice" ADD CONSTRAINT "ResellerOrganizationSkuPrice_variantId_fkey"
      FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
