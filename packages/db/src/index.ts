import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

export { Prisma } from "@prisma/client";
export type {
  AccessBlock,
  AccessBlockKind,
  AppLog,
  AppLogCategory,
  AppLogLevel,
  BlogPost,
  Category,
  DiscountType,
  Order,
  OrderItem,
  OrderStatus,
  Product,
  ProductFulfillmentType,
  ProductVariant,
  PromoCode,
  ReplenishmentRequest,
  ReplenishmentStatus,
  Role,
  SecurityAction,
  SecurityEvent,
  SecuritySeverity,
  Setting,
  SupplierOrder,
  SupplierOrderStatus,
  TreasuryEntryType,
  TreasuryLedgerEntry,
  User,
  VoucherDeliveryLink,
} from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  kuponPrisma: PrismaClient | undefined;
};

export function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to initialize Prisma.");
  }

  return new PrismaClient({
    adapter: new PrismaPg(databaseUrl),
  });
}

export const prisma =
  globalForPrisma.kuponPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.kuponPrisma = prisma;
}
