ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_REVIEW';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'DISPUTED';

ALTER TABLE "User"
ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "identityCreatedAt" TIMESTAMP(3);

ALTER TABLE "Order"
ADD COLUMN "paymentReviewReason" TEXT,
ADD COLUMN "paymentReviewRequiredAt" TIMESTAMP(3),
ADD COLUMN "paymentReviewApprovedAt" TIMESTAMP(3),
ADD COLUMN "paymentReviewApprovedBy" TEXT,
ADD COLUMN "paymentReviewNote" TEXT;

CREATE TABLE "PaymentEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "providerPaymentId" TEXT,
  "orderId" TEXT,
  "payload" JSONB,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentEvent_provider_eventId_key"
ON "PaymentEvent"("provider", "eventId");

CREATE INDEX "PaymentEvent_orderId_createdAt_idx"
ON "PaymentEvent"("orderId", "createdAt");

CREATE INDEX "PaymentEvent_provider_providerPaymentId_idx"
ON "PaymentEvent"("provider", "providerPaymentId");

CREATE INDEX "PaymentEvent_processedAt_idx"
ON "PaymentEvent"("processedAt");

ALTER TABLE "PaymentEvent"
ADD CONSTRAINT "PaymentEvent_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
