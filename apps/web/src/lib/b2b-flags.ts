/** Controlled B2B rollout: only organizations listed here may quote/order. Empty = disabled. */
export function isB2BOrderingEnabled(organizationId: string) {
  const ids = (process.env.B2B_ORDERING_ORG_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return ids.includes(organizationId);
}

export const B2B_ORDERING_ENV_KEY = "B2B_ORDERING_ORG_IDS";
