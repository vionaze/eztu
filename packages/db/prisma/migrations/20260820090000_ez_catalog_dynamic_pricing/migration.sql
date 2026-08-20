-- Country-scoped supplier pricing state.
ALTER TABLE "ProductVariant"
  ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT 'id',
  ADD COLUMN "supplierStatus" TEXT,
  ADD COLUMN "supplierPriceUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "nonCryptoMarkupBps" INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN "cryptoMarkupBps" INTEGER NOT NULL DEFAULT 1200;

CREATE INDEX "ProductVariant_productId_countryCode_idx"
  ON "ProductVariant"("productId", "countryCode");
CREATE INDEX "ProductVariant_supplierSku_countryCode_idx"
  ON "ProductVariant"("supplierSku", "countryCode");

-- Immutable pricing audit snapshot on each order and item.
CREATE TYPE "PaymentPricingTier" AS ENUM ('NON_CRYPTO', 'CRYPTO');

ALTER TABLE "Order"
  ADD COLUMN "pricingTier" "PaymentPricingTier",
  ADD COLUMN "supplierCountryCode" TEXT,
  ADD COLUMN "supplierCostIDR" INTEGER,
  ADD COLUMN "pricingMarkupBps" INTEGER,
  ADD COLUMN "pricingVerifiedAt" TIMESTAMP(3);

ALTER TABLE "OrderItem"
  ADD COLUMN "supplierCostIDR" INTEGER,
  ADD COLUMN "supplierCountryCode" TEXT,
  ADD COLUMN "pricingMarkupBps" INTEGER;

-- Consent-aware anonymous product funnel events.
CREATE TYPE "ProductAnalyticsEventType" AS ENUM (
  'CARD_CLICK',
  'VIEW',
  'VARIANT_SELECTED',
  'PAYMENT_METHOD_SELECTED',
  'QUOTE_ERROR',
  'CHECKOUT_SUBMITTED',
  'CHECKOUT_REJECTED',
  'PAYMENT_CREATED'
);

CREATE TABLE "ProductAnalyticsEvent" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT,
  "eventType" "ProductAnalyticsEventType" NOT NULL,
  "visitorHash" TEXT NOT NULL,
  "countryCode" TEXT,
  "paymentMethod" TEXT,
  "reason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductAnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductAnalyticsEvent_productId_eventType_createdAt_idx"
  ON "ProductAnalyticsEvent"("productId", "eventType", "createdAt");
CREATE INDEX "ProductAnalyticsEvent_variantId_eventType_createdAt_idx"
  ON "ProductAnalyticsEvent"("variantId", "eventType", "createdAt");
CREATE INDEX "ProductAnalyticsEvent_visitorHash_createdAt_idx"
  ON "ProductAnalyticsEvent"("visitorHash", "createdAt");
CREATE INDEX "ProductAnalyticsEvent_createdAt_idx"
  ON "ProductAnalyticsEvent"("createdAt");

ALTER TABLE "ProductAnalyticsEvent"
  ADD CONSTRAINT "ProductAnalyticsEvent_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductAnalyticsEvent"
  ADD CONSTRAINT "ProductAnalyticsEvent_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
