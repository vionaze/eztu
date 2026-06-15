CREATE TYPE "SecuritySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TYPE "SecurityAction" AS ENUM ('FLAGGED', 'BLOCKED');

ALTER TABLE "User"
  ADD COLUMN "lastSeenIp" TEXT,
  ADD COLUMN "lastSeenUserAgent" TEXT,
  ADD COLUMN "lastSeenAt" TIMESTAMP(3);

CREATE TABLE "SecurityEvent" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "severity" "SecuritySeverity" NOT NULL DEFAULT 'LOW',
  "action" "SecurityAction" NOT NULL DEFAULT 'FLAGGED',
  "reasons" TEXT[] NOT NULL,
  "ip" TEXT,
  "userAgent" TEXT,
  "route" TEXT,
  "method" TEXT,
  "origin" TEXT,
  "referer" TEXT,
  "email" TEXT,
  "userId" TEXT,
  "clerkUserId" TEXT,
  "orderId" TEXT,
  "productId" TEXT,
  "variantId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SecurityEvent_eventType_createdAt_idx" ON "SecurityEvent"("eventType", "createdAt");
CREATE INDEX "SecurityEvent_userId_createdAt_idx" ON "SecurityEvent"("userId", "createdAt");
CREATE INDEX "SecurityEvent_ip_createdAt_idx" ON "SecurityEvent"("ip", "createdAt");
CREATE INDEX "SecurityEvent_orderId_createdAt_idx" ON "SecurityEvent"("orderId", "createdAt");

ALTER TABLE "SecurityEvent"
  ADD CONSTRAINT "SecurityEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SecurityEvent"
  ADD CONSTRAINT "SecurityEvent_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
