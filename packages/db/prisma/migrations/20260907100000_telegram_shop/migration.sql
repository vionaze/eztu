ALTER TABLE "Order" ADD COLUMN "telegramChatId" TEXT;
CREATE INDEX "Order_telegramChatId_createdAt_idx" ON "Order"("telegramChatId", "createdAt");
CREATE TABLE "TelegramShopSession" (
  "chatId" TEXT NOT NULL PRIMARY KEY,
  "state" JSONB NOT NULL DEFAULT '{}',
  "lastUpdateId" INTEGER NOT NULL DEFAULT -1,
  "lockToken" TEXT,
  "lockedUntil" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
