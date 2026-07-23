import "server-only";
import { prisma, type AppLogCategory, type AppLogLevel, type Prisma } from "@kupon/db";

export type WriteAppLogInput = {
  category: AppLogCategory;
  level?: AppLogLevel;
  title: string;
  message?: string;
  actor?: string;
  route?: string;
  orderId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Fire-and-forget activity log for the admin Logs page.
 * Never throws to callers — logging must not break checkout/auth.
 */
export async function writeAppLog(input: WriteAppLogInput): Promise<void> {
  try {
    await prisma.appLog.create({
      data: {
        category: input.category,
        level: input.level || "INFO",
        title: input.title.slice(0, 200),
        message: input.message?.slice(0, 2000),
        actor: input.actor?.slice(0, 200),
        route: input.route?.slice(0, 300),
        orderId: input.orderId,
        metadata: (input.metadata || undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (error) {
    console.error("[AppLog] Failed to write log", error);
  }
}

export const LOG_CATEGORY_META: Record<
  AppLogCategory,
  { label: string; color: string; badge: string }
> = {
  SALES: {
    label: "Sales",
    color: "text-emerald-300",
    badge: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  },
  PAYMENT: {
    label: "Payment",
    color: "text-sky-300",
    badge: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  },
  FULFILLMENT: {
    label: "Fulfillment",
    color: "text-violet-300",
    badge: "border-violet-400/30 bg-violet-400/10 text-violet-300",
  },
  AUTH: {
    label: "Auth",
    color: "text-amber-300",
    badge: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  },
  SECURITY: {
    label: "Security",
    color: "text-red-300",
    badge: "border-red-400/30 bg-red-400/10 text-red-300",
  },
  BLOG: {
    label: "Blog",
    color: "text-fuchsia-300",
    badge: "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-300",
  },
  ADMIN: {
    label: "Admin",
    color: "text-orange-300",
    badge: "border-orange-400/30 bg-orange-400/10 text-orange-300",
  },
  SYSTEM: {
    label: "System",
    color: "text-zinc-300",
    badge: "border-zinc-400/30 bg-zinc-400/10 text-zinc-300",
  },
};
