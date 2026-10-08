/**
 * Wholesale ordering rollout decision.
 *
 * Sources of truth, in order of precedence:
 * 1. `B2B_ORDERING_DISABLED=true` is a global emergency stop and always wins.
 * 2. The per-organization `orderingEnabled` flag toggled by admins (primary path).
 * 3. `B2B_ORDERING_ORG_IDS` allowlist (legacy/pilot escape hatch; comma-separated).
 */
export function evaluateOrderingEnabled(params: {
  organizationId: string;
  organizationFlag: boolean;
  globalDisabled: boolean;
  allowlist: string;
}) {
  if (params.globalDisabled) return false;
  if (params.organizationFlag) return true;
  return params.allowlist
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(params.organizationId);
}

export function isB2BOrderingEnabled(organizationId: string, organizationFlag = false) {
  return evaluateOrderingEnabled({
    organizationId,
    organizationFlag,
    globalDisabled: (process.env.B2B_ORDERING_DISABLED || "").trim().toLowerCase() === "true",
    allowlist: process.env.B2B_ORDERING_ORG_IDS || "",
  });
}

export const B2B_ORDERING_ENV_KEYS = {
  allowlist: "B2B_ORDERING_ORG_IDS",
  killSwitch: "B2B_ORDERING_DISABLED",
} as const;
