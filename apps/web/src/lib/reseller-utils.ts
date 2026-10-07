export function slugifyReseller(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s_-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

export type ResellerStatus = "PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED";

export function canTransitionResellerStatus(
  current: ResellerStatus,
  next: ResellerStatus,
) {
  if (current === next) return true;
  if (current === "PENDING") return next === "ACTIVE" || next === "REJECTED";
  if (current === "REJECTED") return next === "ACTIVE";
  if (current === "ACTIVE") return next === "SUSPENDED";
  return next === "ACTIVE";
}

export function resellerDisplayStatus(status: string) {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "REJECTED":
      return "Rejected";
    case "SUSPENDED":
      return "Suspended";
    default:
      return "Pending approval";
  }
}
