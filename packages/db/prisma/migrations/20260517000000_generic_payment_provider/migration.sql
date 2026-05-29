-- Rename Cryptomus-specific order payment fields to provider-neutral fields.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Order' AND column_name = 'cryptomusId'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Order' AND column_name = 'paymentProviderPaymentId'
  ) THEN
    ALTER TABLE "Order" RENAME COLUMN "cryptomusId" TO "paymentProviderPaymentId";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Order' AND column_name = 'cryptomusTxHash'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Order' AND column_name = 'paymentProviderTxHash'
  ) THEN
    ALTER TABLE "Order" RENAME COLUMN "cryptomusTxHash" TO "paymentProviderTxHash";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Order' AND column_name = 'cryptoCurrency'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Order' AND column_name = 'paymentCurrency'
  ) THEN
    ALTER TABLE "Order" RENAME COLUMN "cryptoCurrency" TO "paymentCurrency";
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Order' AND column_name = 'paymentProvider'
  ) THEN
    ALTER TABLE "Order" ADD COLUMN "paymentProvider" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Order' AND column_name = 'paymentProviderInvoiceId'
  ) THEN
    ALTER TABLE "Order" ADD COLUMN "paymentProviderInvoiceId" TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'Order_cryptomusId_key'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'Order_paymentProviderPaymentId_key'
  ) THEN
    ALTER INDEX "Order_cryptomusId_key" RENAME TO "Order_paymentProviderPaymentId_key";
  END IF;
END $$;

UPDATE "Order"
SET "paymentProvider" = 'cryptomus'
WHERE "paymentProviderPaymentId" IS NOT NULL
  AND "paymentProvider" IS NULL;
