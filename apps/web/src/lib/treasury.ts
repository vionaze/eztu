import { Prisma, prisma, type TreasuryEntryType } from "@kupon/db";
import { sendDiscordReplenishmentAlert } from "@/lib/discord";

const SUPPLIER_BALANCE_KEY = "inventory.balanceIDR";

function getEnvNumber(name: string, fallback: number) {
  const value = process.env[name];
  if (!value) return fallback;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getSupplierCostRate() {
  const rate = getEnvNumber("TREASURY_SUPPLIER_COST_RATE", 0.95);
  if (rate <= 0 || rate > 1) return 0.95;
  return rate;
}

export function calculateSupplierCostIDR(saleAmountIDR: number) {
  return Math.round(saleAmountIDR * getSupplierCostRate());
}

async function getSupplierBalanceIDR() {
  const setting = await prisma.setting.findUnique({
    where: { key: SUPPLIER_BALANCE_KEY },
  });

  if (setting) {
    const parsed = Number(setting.value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const startingBalance = getEnvNumber("SUPPLIER_BALANCE_IDR", 0);
  await prisma.setting.upsert({
    where: { key: SUPPLIER_BALANCE_KEY },
    update: { value: startingBalance.toString() },
    create: {
      key: SUPPLIER_BALANCE_KEY,
      value: startingBalance.toString(),
    },
  });

  return startingBalance;
}

async function setSupplierBalanceIDR(balanceIDR: number) {
  await prisma.setting.upsert({
    where: { key: SUPPLIER_BALANCE_KEY },
    update: { value: balanceIDR.toString() },
    create: {
      key: SUPPLIER_BALANCE_KEY,
      value: balanceIDR.toString(),
    },
  });
}

async function createLedgerEntryOnce(params: {
  orderId: string;
  type: TreasuryEntryType;
  currency: string;
  amountIDR?: number;
  amountUSD?: number;
  description: string;
  metadata?: Prisma.InputJsonObject;
}) {
  const existing = await prisma.treasuryLedgerEntry.findFirst({
    where: {
      orderId: params.orderId,
      type: params.type,
    },
  });

  if (existing) return existing;

  return prisma.treasuryLedgerEntry.create({ data: params });
}

export async function recordFulfilledOrderTreasury(params: {
  orderId: string;
  orderNumber: string;
  saleAmountIDR: number;
  saleAmountUSD: number;
  supplierCostIDR: number;
  paymentCurrency?: string | null;
}) {
  const profitIDR = params.saleAmountIDR - params.supplierCostIDR;
  const profitUSD =
    params.saleAmountIDR > 0
      ? Number(((params.saleAmountUSD * profitIDR) / params.saleAmountIDR).toFixed(2))
      : 0;

  await createLedgerEntryOnce({
    orderId: params.orderId,
    type: "CUSTOMER_REVENUE",
    currency: params.paymentCurrency || "crypto",
    amountIDR: params.saleAmountIDR,
    amountUSD: params.saleAmountUSD,
    description: `Customer revenue for ${params.orderNumber}`,
  });

  await createLedgerEntryOnce({
    orderId: params.orderId,
    type: "SUPPLIER_COST",
    currency: "IDR",
    amountIDR: params.supplierCostIDR,
    description: `Inventory cost for ${params.orderNumber}`,
  });

  await createLedgerEntryOnce({
    orderId: params.orderId,
    type: "PROFIT_ESTIMATE",
    currency: params.paymentCurrency || "stablecoin",
    amountIDR: profitIDR,
    amountUSD: profitUSD,
    description: `Estimated profit for ${params.orderNumber}`,
  });

  const existingBalanceDebit = await prisma.treasuryLedgerEntry.findFirst({
    where: {
      orderId: params.orderId,
      type: "SUPPLIER_BALANCE_DEBIT",
    },
    orderBy: { createdAt: "asc" },
  });

  if (existingBalanceDebit) {
    const currentBalanceIDR = await getSupplierBalanceIDR();
    return {
      profitIDR,
      profitUSD,
      flexaGiftBalanceIDR: currentBalanceIDR,
    };
  }

  const currentBalanceIDR = await getSupplierBalanceIDR();
  const newBalanceIDR = currentBalanceIDR - params.supplierCostIDR;

  await setSupplierBalanceIDR(newBalanceIDR);
  await createLedgerEntryOnce({
    orderId: params.orderId,
    type: "SUPPLIER_BALANCE_DEBIT",
    currency: "IDR",
    amountIDR: params.supplierCostIDR,
    description: `Inventory balance debit for ${params.orderNumber}`,
    metadata: {
      previousBalanceIDR: currentBalanceIDR,
      newBalanceIDR,
    },
  });

  await maybeCreateReplenishmentRequest(newBalanceIDR);

  return {
    profitIDR,
    profitUSD,
    flexaGiftBalanceIDR: newBalanceIDR,
  };
}

async function maybeCreateReplenishmentRequest(currentBalanceIDR: number) {
  const thresholdIDR = getEnvNumber("SUPPLIER_REPLENISH_THRESHOLD_IDR", 0);
  if (!thresholdIDR || currentBalanceIDR >= thresholdIDR) return null;

  const targetBalanceIDR = getEnvNumber(
    "SUPPLIER_REPLENISH_TARGET_IDR",
    thresholdIDR * 2
  );
  const requestedAmountIDR = Math.max(0, targetBalanceIDR - currentBalanceIDR);
  const openRequest = await prisma.replenishmentRequest.findFirst({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
  });

  if (openRequest) {
    return prisma.replenishmentRequest.update({
      where: { id: openRequest.id },
      data: {
        currentBalanceIDR,
        thresholdIDR,
        targetBalanceIDR,
        requestedAmountIDR,
      },
    });
  }

  const request = await prisma.replenishmentRequest.create({
    data: {
      currentBalanceIDR,
      thresholdIDR,
      targetBalanceIDR,
      requestedAmountIDR,
      note: "Manual IDR off-ramp needed: convert stablecoin externally, then top up inventory balance.",
    },
  });

  await sendDiscordReplenishmentAlert({
    currentBalanceIDR,
    thresholdIDR,
    targetBalanceIDR,
    requestedAmountIDR,
  });

  return request;
}
