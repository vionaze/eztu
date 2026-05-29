-- CreateEnum
CREATE TYPE "SupplierOrderStatus" AS ENUM ('PENDING', 'PROCESSING', 'FULFILLED', 'FAILED', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "TreasuryEntryType" AS ENUM ('CUSTOMER_REVENUE', 'SUPPLIER_COST', 'PROFIT_ESTIMATE', 'FLEXAGIFT_BALANCE_DEBIT', 'REPLENISHMENT_REQUEST');

-- CreateEnum
CREATE TYPE "ReplenishmentStatus" AS ENUM ('OPEN', 'SENT', 'RESOLVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "SupplierOrder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerOrderId" TEXT,
    "status" "SupplierOrderStatus" NOT NULL DEFAULT 'PENDING',
    "productName" TEXT NOT NULL,
    "variantName" TEXT NOT NULL,
    "costIDR" INTEGER NOT NULL,
    "voucherCode" TEXT,
    "voucherPin" TEXT,
    "raw" JSONB,
    "error" TEXT,
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreasuryLedgerEntry" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "type" "TreasuryEntryType" NOT NULL,
    "currency" TEXT NOT NULL,
    "amountIDR" INTEGER,
    "amountUSD" DOUBLE PRECISION,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreasuryLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplenishmentRequest" (
    "id" TEXT NOT NULL,
    "status" "ReplenishmentStatus" NOT NULL DEFAULT 'OPEN',
    "currentBalanceIDR" INTEGER NOT NULL,
    "thresholdIDR" INTEGER NOT NULL,
    "targetBalanceIDR" INTEGER NOT NULL,
    "requestedAmountIDR" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ReplenishmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierOrder_orderId_key" ON "SupplierOrder"("orderId");

-- AddForeignKey
ALTER TABLE "SupplierOrder" ADD CONSTRAINT "SupplierOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryLedgerEntry" ADD CONSTRAINT "TreasuryLedgerEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
