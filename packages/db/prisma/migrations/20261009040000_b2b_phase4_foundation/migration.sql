DO $$ BEGIN
  CREATE TYPE "B2BOrderStatus" AS ENUM ('DRAFT','PAYMENT_PENDING','PAID','PROCESSING','COMPLETED','PAYMENT_FAILED','CANCELLED','MANUAL_REVIEW','REFUND_PENDING','REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "B2BPaymentMethod" AS ENUM ('CRYPTO','PAKASIR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "B2BPaymentIntentStatus" AS ENUM ('PENDING','PAID','FAILED','EXPIRED','REVIEW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "B2BWalletLedgerType" AS ENUM ('DEPOSIT_PENDING','DEPOSIT_CONFIRMED','RESERVE','CAPTURE','RELEASE','REFUND','ADJUSTMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "B2BOrder" (
  "id" TEXT NOT NULL, "orderNumber" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "createdByUserId" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'RESELLER_B2B', "paymentMethod" "B2BPaymentMethod" NOT NULL,
  "status" "B2BOrderStatus" NOT NULL DEFAULT 'DRAFT', "idempotencyKey" TEXT NOT NULL, "requestFingerprint" TEXT NOT NULL, "quotedAt" TIMESTAMP(3) NOT NULL,
  "subtotalIDR" BIGINT NOT NULL, "totalIDR" BIGINT NOT NULL, "totalUSD" DECIMAL(18,6), "totalUSDCents" BIGINT,
  "usdIdrRate" DECIMAL(18,6), "fxSource" TEXT, "fxQuotedAt" TIMESTAMP(3), "quoteExpiresAt" TIMESTAMP(3),
  "paymentProvider" TEXT, "paymentProviderPaymentId" TEXT, "paymentProviderInvoiceId" TEXT, "paymentUrl" TEXT, "paidAt" TIMESTAMP(3),
  "supplierReference" TEXT, "supplierStatus" TEXT, "manualReviewReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "B2BOrder_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "B2BOrderLine" (
  "id" TEXT NOT NULL, "orderId" TEXT NOT NULL, "variantId" TEXT NOT NULL, "supplierSku" TEXT NOT NULL, "supplierCountryCode" TEXT NOT NULL,
  "productName" TEXT NOT NULL, "variantName" TEXT NOT NULL, "quantity" INTEGER NOT NULL,
  "unitPriceIDR" BIGINT NOT NULL, "totalPriceIDR" BIGINT NOT NULL, "supplierCostIDR" BIGINT NOT NULL,
  "resellerTier" "ResellerTier" NOT NULL, "pricingRuleRevision" INTEGER NOT NULL, "pricingRuleId" TEXT NOT NULL, "pricingMode" "ResellerPriceMode" NOT NULL,
  "markupMicros" INTEGER, "fixedPriceIDR" BIGINT, "supplierTid" TEXT, "supplierStatus" TEXT, "supplierRaw" JSONB,
  "status" TEXT NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "B2BOrderLine_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "B2BPaymentIntent" (
  "id" TEXT NOT NULL, "orderId" TEXT NOT NULL, "provider" TEXT NOT NULL, "status" "B2BPaymentIntentStatus" NOT NULL DEFAULT 'PENDING',
  "amountIDR" BIGINT NOT NULL, "amountUSDCents" BIGINT, "currency" TEXT NOT NULL, "usdIdrRate" DECIMAL(18,6), "fxSource" TEXT,
  "providerPaymentId" TEXT, "providerInvoiceId" TEXT, "paymentUrl" TEXT, "expiresAt" TIMESTAMP(3), "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "B2BPaymentIntent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "B2BPaymentEvent" (
  "id" TEXT NOT NULL, "provider" TEXT NOT NULL, "eventId" TEXT NOT NULL, "paymentIntentId" TEXT NOT NULL,
  "normalizedStatus" "B2BPaymentIntentStatus" NOT NULL, "payload" JSONB, "processedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "B2BPaymentEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "B2BWalletAccount" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "currency" TEXT NOT NULL DEFAULT 'IDR', "status" TEXT NOT NULL DEFAULT 'DISABLED',
  "availableIDR" BIGINT NOT NULL DEFAULT 0, "reservedIDR" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "B2BWalletAccount_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "B2BWalletLedger" (
  "id" TEXT NOT NULL, "accountId" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "type" "B2BWalletLedgerType" NOT NULL,
  "amountIDR" BIGINT NOT NULL, "idempotencyKey" TEXT NOT NULL, "orderId" TEXT, "paymentIntentId" TEXT, "actorUserId" TEXT, "reason" TEXT, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "B2BWalletLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "B2BOrder_orderNumber_key" ON "B2BOrder"("orderNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "B2BOrder_organizationId_idempotencyKey_key" ON "B2BOrder"("organizationId","idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "B2BOrder_supplierReference_key" ON "B2BOrder"("supplierReference");
CREATE INDEX IF NOT EXISTS "B2BOrder_organizationId_createdAt_idx" ON "B2BOrder"("organizationId","createdAt");
CREATE INDEX IF NOT EXISTS "B2BOrder_status_createdAt_idx" ON "B2BOrder"("status","createdAt");
CREATE INDEX IF NOT EXISTS "B2BOrderLine_orderId_status_idx" ON "B2BOrderLine"("orderId","status");
CREATE INDEX IF NOT EXISTS "B2BOrderLine_variantId_idx" ON "B2BOrderLine"("variantId");
CREATE INDEX IF NOT EXISTS "B2BOrderLine_supplierTid_idx" ON "B2BOrderLine"("supplierTid");
CREATE UNIQUE INDEX IF NOT EXISTS "B2BPaymentIntent_orderId_key" ON "B2BPaymentIntent"("orderId");
CREATE UNIQUE INDEX IF NOT EXISTS "B2BPaymentIntent_provider_providerPaymentId_key" ON "B2BPaymentIntent"("provider","providerPaymentId");
CREATE INDEX IF NOT EXISTS "B2BPaymentIntent_status_createdAt_idx" ON "B2BPaymentIntent"("status","createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "B2BPaymentEvent_provider_eventId_key" ON "B2BPaymentEvent"("provider","eventId");
CREATE INDEX IF NOT EXISTS "B2BPaymentEvent_paymentIntentId_createdAt_idx" ON "B2BPaymentEvent"("paymentIntentId","createdAt");
CREATE INDEX IF NOT EXISTS "B2BPaymentEvent_processedAt_idx" ON "B2BPaymentEvent"("processedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "B2BWalletAccount_organizationId_currency_key" ON "B2BWalletAccount"("organizationId","currency");
CREATE UNIQUE INDEX IF NOT EXISTS "B2BWalletAccount_id_organizationId_key" ON "B2BWalletAccount"("id","organizationId");
CREATE INDEX IF NOT EXISTS "B2BWalletAccount_status_updatedAt_idx" ON "B2BWalletAccount"("status","updatedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "B2BWalletLedger_idempotencyKey_key" ON "B2BWalletLedger"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "B2BWalletLedger_organizationId_createdAt_idx" ON "B2BWalletLedger"("organizationId","createdAt");
CREATE INDEX IF NOT EXISTS "B2BWalletLedger_accountId_createdAt_idx" ON "B2BWalletLedger"("accountId","createdAt");
CREATE INDEX IF NOT EXISTS "B2BWalletLedger_orderId_idx" ON "B2BWalletLedger"("orderId");
CREATE INDEX IF NOT EXISTS "B2BWalletLedger_paymentIntentId_idx" ON "B2BWalletLedger"("paymentIntentId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='B2BOrder_organizationId_fkey') THEN ALTER TABLE "B2BOrder" ADD CONSTRAINT "B2BOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "ResellerOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='B2BOrder_createdByUserId_fkey') THEN ALTER TABLE "B2BOrder" ADD CONSTRAINT "B2BOrder_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='B2BOrderLine_orderId_fkey') THEN ALTER TABLE "B2BOrderLine" ADD CONSTRAINT "B2BOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "B2BOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='B2BOrderLine_variantId_fkey') THEN ALTER TABLE "B2BOrderLine" ADD CONSTRAINT "B2BOrderLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='B2BPaymentIntent_orderId_fkey') THEN ALTER TABLE "B2BPaymentIntent" ADD CONSTRAINT "B2BPaymentIntent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "B2BOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='B2BPaymentEvent_paymentIntentId_fkey') THEN ALTER TABLE "B2BPaymentEvent" ADD CONSTRAINT "B2BPaymentEvent_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "B2BPaymentIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='B2BWalletAccount_organizationId_fkey') THEN ALTER TABLE "B2BWalletAccount" ADD CONSTRAINT "B2BWalletAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "ResellerOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='B2BWalletLedger_accountId_organizationId_fkey') THEN ALTER TABLE "B2BWalletLedger" ADD CONSTRAINT "B2BWalletLedger_accountId_organizationId_fkey" FOREIGN KEY ("accountId","organizationId") REFERENCES "B2BWalletAccount"("id","organizationId") ON DELETE RESTRICT ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='B2BWalletLedger_organizationId_fkey') THEN ALTER TABLE "B2BWalletLedger" ADD CONSTRAINT "B2BWalletLedger_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "ResellerOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='B2BWalletLedger_orderId_fkey') THEN ALTER TABLE "B2BWalletLedger" ADD CONSTRAINT "B2BWalletLedger_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "B2BOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF;
END $$;

DO $$ BEGIN
  ALTER TABLE "B2BOrder" ADD CONSTRAINT "B2BOrder_nonnegative_check" CHECK ("subtotalIDR" >= 0 AND "totalIDR" >= 0 AND ("totalUSDCents" IS NULL OR "totalUSDCents" >= 0));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "B2BOrderLine" ADD CONSTRAINT "B2BOrderLine_amount_check" CHECK ("quantity" > 0 AND "unitPriceIDR" >= 0 AND "totalPriceIDR" >= 0 AND "supplierCostIDR" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "B2BWalletAccount" ADD CONSTRAINT "B2BWalletAccount_balance_check" CHECK ("availableIDR" >= 0 AND "reservedIDR" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "B2BWalletLedger" ADD CONSTRAINT "B2BWalletLedger_amount_check" CHECK ("amountIDR" <> 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "B2BOrder" ADD CONSTRAINT "B2BOrder_channel_check" CHECK ("channel" = 'RESELLER_B2B' AND length("idempotencyKey") > 0 AND length("requestFingerprint") > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "B2BOrderLine" ADD CONSTRAINT "B2BOrderLine_pricing_check" CHECK (
    "pricingRuleRevision" > 0 AND "totalPriceIDR" = "unitPriceIDR"::numeric * "quantity" AND
    (("pricingMode" = 'MARKUP' AND "markupMicros" BETWEEN 0 AND 100000000 AND "markupMicros" IS NOT NULL AND "fixedPriceIDR" IS NULL)
    OR ("pricingMode" = 'FIXED' AND "markupMicros" IS NULL AND "fixedPriceIDR" IS NOT NULL AND "fixedPriceIDR" > 0))
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "B2BPaymentIntent" ADD CONSTRAINT "B2BPaymentIntent_amount_check" CHECK ("amountIDR" > 0 AND ("amountUSDCents" IS NULL OR "amountUSDCents" > 0));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "B2BWalletAccount" ADD CONSTRAINT "B2BWalletAccount_currency_check" CHECK ("currency" = 'IDR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION b2b_wallet_ledger_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'B2B wallet ledger is append-only; create a compensating entry';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "B2BWalletLedger_append_only" ON "B2BWalletLedger";
CREATE TRIGGER "B2BWalletLedger_append_only" BEFORE UPDATE OR DELETE ON "B2BWalletLedger"
FOR EACH ROW EXECUTE FUNCTION b2b_wallet_ledger_append_only();
