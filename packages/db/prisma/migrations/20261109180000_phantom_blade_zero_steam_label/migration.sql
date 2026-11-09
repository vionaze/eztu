-- Rename the Phantom Blade Zero storefront/reseller title so buyers can
-- tell the platform is Steam. Slug and SKUs stay unchanged.
UPDATE "Product"
SET "name" = 'Phantom Blade Zero (steam)'
WHERE "slug" = 'phantom-blade-zero'
  AND "name" <> 'Phantom Blade Zero (steam)';
