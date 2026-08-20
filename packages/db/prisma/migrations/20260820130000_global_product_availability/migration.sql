ALTER TABLE "Product"
ADD COLUMN "globalAvailability" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Product"
SET "globalAvailability" = true
WHERE "id" = 'eztopup-mobile-legends-global'
   OR "slug" = 'mobile-legends-global';
