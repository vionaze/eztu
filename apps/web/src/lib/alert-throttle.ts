/**
 * In-process throttle for security alerts sent to Discord.
 *
 * The database (SecurityEvent) stays the source of truth: every event is still
 * written. This module only decides whether a *notification* is worth sending,
 * so a single noisy actor (e.g. a bot hammering /api/payment/create) cannot
 * flood the channel and bury real incidents.
 *
 * Scope: per process. On the VPS the app runs as a single PM2 instance, so the
 * window is shared by all requests. If it is ever scaled out, each instance
 * keeps its own window and the effective rate is multiplied by the instance
 * count — acceptable, since this is noise reduction, not a security control.
 */

/** Sliding window used by the global cap. */
const WINDOW_MS = 10 * 60 * 1000;
/** Minimum gap between two Discord messages for the same event + IP. */
const PER_KEY_COOLDOWN_MS = 10 * 60 * 1000;
/** Hard ceiling of notifications per window, regardless of source. */
const MAX_ALERTS_PER_WINDOW = 20;
/** Bound on tracked keys so a rotating-IP flood cannot grow memory forever. */
const MAX_TRACKED_KEYS = 500;

const lastSentByKey = new Map<string, number>();
const recentSends: number[] = [];

export type AlertSlot = "send" | "cooldown" | "flood";

function prune(now: number) {
  while (recentSends.length > 0 && now - recentSends[0] >= WINDOW_MS) {
    recentSends.shift();
  }

  if (lastSentByKey.size > MAX_TRACKED_KEYS) {
    for (const [key, sentAt] of lastSentByKey) {
      if (now - sentAt >= PER_KEY_COOLDOWN_MS) lastSentByKey.delete(key);
    }
    // Still oversized (everything recent): drop to avoid unbounded growth.
    if (lastSentByKey.size > MAX_TRACKED_KEYS) lastSentByKey.clear();
  }
}

/**
 * Reserve a notification slot.
 *
 * - `send`     → post to Discord
 * - `cooldown` → same event + IP already reported recently
 * - `flood`    → global cap reached; something is generating volume, keep it in DB only
 */
export function takeAlertSlot(
  input: { eventType: string; ip: string },
  now = Date.now()
): AlertSlot {
  prune(now);

  const key = `${input.eventType}|${input.ip || "unknown"}`;
  const lastSent = lastSentByKey.get(key);

  if (lastSent !== undefined && now - lastSent < PER_KEY_COOLDOWN_MS) {
    return "cooldown";
  }

  if (recentSends.length >= MAX_ALERTS_PER_WINDOW) {
    return "flood";
  }

  lastSentByKey.set(key, now);
  recentSends.push(now);
  return "send";
}

/** Test helper — clears the window. */
export function resetAlertThrottle() {
  lastSentByKey.clear();
  recentSends.length = 0;
}
