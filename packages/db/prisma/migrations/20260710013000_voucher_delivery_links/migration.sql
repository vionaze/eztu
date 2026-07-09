CREATE TABLE "VoucherDeliveryLink" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3),
  "lastSendError" TEXT,
  "firstVisitedAt" TIMESTAMP(3),
  "lastVisitedAt" TIMESTAMP(3),
  "visitCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VoucherDeliveryLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VoucherDeliveryLink_orderId_key" ON "VoucherDeliveryLink"("orderId");
CREATE UNIQUE INDEX "VoucherDeliveryLink_tokenHash_key" ON "VoucherDeliveryLink"("tokenHash");
CREATE INDEX "VoucherDeliveryLink_sentAt_idx" ON "VoucherDeliveryLink"("sentAt");
CREATE INDEX "VoucherDeliveryLink_firstVisitedAt_idx" ON "VoucherDeliveryLink"("firstVisitedAt");
CREATE INDEX "VoucherDeliveryLink_createdAt_idx" ON "VoucherDeliveryLink"("createdAt");

ALTER TABLE "VoucherDeliveryLink"
  ADD CONSTRAINT "VoucherDeliveryLink_orderId_fkey"
  FOREIGN KEY ("orderId")
  REFERENCES "Order"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
