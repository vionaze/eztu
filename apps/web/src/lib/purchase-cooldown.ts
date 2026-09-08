import "server-only";
import { prisma } from "@kupon/db";

export class PurchaseCooldownError extends Error {
  constructor(public retryAt: Date) {
    super("After a successful purchase of 15 or more units, please wait 8 hours before placing another order.");
    this.name = "PurchaseCooldownError";
  }
}

export async function enforcePurchaseCooldown(userId: string) {
  const recent = await prisma.supplierOrder.findFirst({
    where: { status: "FULFILLED", fulfilledAt: { gt: new Date(Date.now() - 8 * 60 * 60 * 1000) },
      order: { userId, items: { some: { quantity: { gte: 15 } } } } },
    orderBy: { fulfilledAt: "desc" }, select: { fulfilledAt: true },
  });
  if (recent?.fulfilledAt) throw new PurchaseCooldownError(new Date(recent.fulfilledAt.getTime() + 8 * 60 * 60 * 1000));
}
