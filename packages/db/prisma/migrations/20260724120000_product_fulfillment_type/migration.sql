-- Product fulfillment: top-up (game account) vs voucher code
DO $$ BEGIN
  CREATE TYPE "ProductFulfillmentType" AS ENUM ('TOP_UP', 'VOUCHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "fulfillmentType" "ProductFulfillmentType" NOT NULL DEFAULT 'VOUCHER';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "requiresServerId" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "gameIdLabel" TEXT DEFAULT 'User ID';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "serverIdLabel" TEXT DEFAULT 'Zone / Server ID';

-- Backfill known Mobile Legends top-up products
UPDATE "Product"
SET
  "fulfillmentType" = 'TOP_UP',
  "requiresServerId" = true,
  "gameIdLabel" = 'User ID',
  "serverIdLabel" = 'Zone / Server ID'
WHERE
  lower("slug") LIKE '%mobile-legends%'
  OR lower("name") LIKE '%mobile legends%'
  OR lower("name") LIKE '%mlbb%';
