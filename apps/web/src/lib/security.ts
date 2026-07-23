import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time string compare for secrets (Bearer tokens, callback tokens).
 * Avoids short-circuit leaks from `===`.
 */
export function safeEqualSecret(
  provided: string | null | undefined,
  expected: string | null | undefined
): boolean {
  if (!provided || !expected) return false;
  try {
    const a = Buffer.from(provided, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) {
      // Still compare against self to keep rough timing similar
      timingSafeEqual(a, a);
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}
