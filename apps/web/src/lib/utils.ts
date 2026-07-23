/**
 * Merge classnames conditionally (like clsx/cn but zero-dep)
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Format price to IDR or USD display
 */
export function formatPrice(amount: number, currency: "IDR" | "USD" = "IDR"): string {
  if (currency === "IDR") {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Generate URL-safe slug from text
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Admin UI timezone: GMT+7 Jakarta (WIB) */
export const ADMIN_TIMEZONE = "Asia/Jakarta";

/**
 * Absolute datetime for admin tables (always Asia/Jakarta).
 * Example: 24 Jul 2026, 11:52:03 WIB
 */
export function formatAdminDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";

  const formatted = d.toLocaleString("en-GB", {
    timeZone: ADMIN_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `${formatted} WIB`;
}

/**
 * Short absolute time for compact lists (Jakarta).
 * Example: 24 Jul, 11:52 WIB
 */
export function formatAdminDateTimeShort(
  date: Date | string | null | undefined
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";

  const formatted = d.toLocaleString("en-GB", {
    timeZone: ADMIN_TIMEZONE,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${formatted} WIB`;
}

/**
 * Relative time + absolute Jakarta time (for dashboard).
 * Example: 5 min ago · 24 Jul, 11:47 WIB
 */
export function formatAdminRelative(
  date: Date | string | null | undefined
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";

  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  let relative: string;
  if (seconds < 60) relative = `${Math.max(0, seconds)}s ago`;
  else if (seconds < 3600) relative = `${Math.floor(seconds / 60)} min ago`;
  else if (seconds < 86400) relative = `${Math.floor(seconds / 3600)} hr ago`;
  else relative = `${Math.floor(seconds / 86400)}d ago`;

  return `${relative} · ${formatAdminDateTimeShort(d)}`;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length).trimEnd() + "...";
}

/**
 * Generate order number
 */
export function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `KPN-${timestamp}-${random}`;
}
