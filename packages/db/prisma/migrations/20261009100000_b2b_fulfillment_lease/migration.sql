ALTER TABLE "B2BOrder"
  ADD COLUMN IF NOT EXISTS "fulfillmentAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "fulfillmentLeaseUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastReconciledAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "B2BOrder_status_fulfillmentLeaseUntil_idx"
  ON "B2BOrder"("status", "fulfillmentLeaseUntil");

DO $$ BEGIN
  ALTER TABLE "B2BOrder" ADD CONSTRAINT "B2BOrder_fulfillmentAttempts_check" CHECK ("fulfillmentAttempts" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
