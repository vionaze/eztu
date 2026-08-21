ALTER TABLE "Product"
ADD COLUMN "unavailableMarketCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "Product"
SET
  "globalAvailability" = true,
  "unavailableMarketCodes" = ARRAY['vn']::TEXT[]
WHERE "id" = 'eztopup-roblox-gift-card'
   OR "slug" = 'roblox-gift-card';
