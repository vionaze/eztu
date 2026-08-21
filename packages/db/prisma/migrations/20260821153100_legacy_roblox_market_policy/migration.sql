UPDATE "Product"
SET
  "globalAvailability" = true,
  "unavailableMarketCodes" = ARRAY['vn']::TEXT[]
WHERE "id" IN ('eztopup-roblox', 'eztopup-roblox-gift-card')
   OR "slug" IN ('roblox', 'roblox-gift-card');
