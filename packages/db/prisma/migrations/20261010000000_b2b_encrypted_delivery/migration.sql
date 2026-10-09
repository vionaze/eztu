ALTER TABLE "B2BOrder"
  ADD COLUMN "secureDelivery" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deliveryEmailSentAt" TIMESTAMP(3);

CREATE TABLE "B2BOrderDelivery" (
  "orderId" TEXT NOT NULL,
  "encryptedFile" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "B2BOrderDelivery_pkey" PRIMARY KEY ("orderId"),
  CONSTRAINT "B2BOrderDelivery_orderId_fkey" FOREIGN KEY ("orderId")
    REFERENCES "B2BOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
