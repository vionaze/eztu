import "server-only";
import { prisma, type AccessBlockKind, type Prisma, type Role } from "@kupon/db";

export type BlockTarget = {
  email?: string | null;
  ip?: string | null;
  clerkUserId?: string | null;
  userId?: string | null;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeIp(ip: string) {
  return ip.trim();
}

/** Local copy of admin email allowlist (avoid circular import with clerk.ts). */
function getAdminEmailAllowlist(): string[] {
  const raw =
    process.env.ADMIN_EMAILS?.trim() ||
    process.env.SUPERADMIN_EMAILS?.trim() ||
    "aigaktidur@gmail.com";

  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeBlockValue(kind: AccessBlockKind, value: string) {
  const trimmed = value.trim();
  if (kind === "EMAIL") return normalizeEmail(trimmed);
  if (kind === "IP") return normalizeIp(trimmed);
  return trimmed;
}

/**
 * IPs that must never be access-blocked (VPS + env allowlist + admin lastSeen).
 * Env: TRUSTED_IPS or FRAUD_NEVER_BLOCK_IPS (comma-separated).
 * Default includes production VPS egress.
 */
export function getEnvTrustedIps(): string[] {
  const raw =
    process.env.TRUSTED_IPS?.trim() ||
    process.env.FRAUD_NEVER_BLOCK_IPS?.trim() ||
    "161.97.130.68,127.0.0.1,::1";

  return raw
    .split(",")
    .map((ip) => normalizeIp(ip))
    .filter(Boolean);
}

export async function getNeverBlockIps(): Promise<Set<string>> {
  const ips = new Set(getEnvTrustedIps());

  const adminRows = await prisma.user.findMany({
    where: {
      role: { in: ["ADMIN", "SUPERADMIN"] },
      lastSeenIp: { not: null },
    },
    select: { lastSeenIp: true },
  });

  for (const row of adminRows) {
    const ip = row.lastSeenIp?.trim();
    if (ip && ip !== "unknown" && ip !== "system") {
      ips.add(ip);
    }
  }

  return ips;
}

export async function getNeverBlockEmails(): Promise<Set<string>> {
  const emails = new Set(getAdminEmailAllowlist());

  const adminRows = await prisma.user.findMany({
    where: {
      role: { in: ["ADMIN", "SUPERADMIN"] },
      email: { not: null },
    },
    select: { email: true },
  });

  for (const row of adminRows) {
    if (row.email) emails.add(normalizeEmail(row.email));
  }

  return emails;
}

export async function isProtectedBlockTarget(
  target: BlockTarget
): Promise<{ protected: boolean; reason?: string }> {
  if (target.ip?.trim() && target.ip !== "unknown" && target.ip !== "system") {
    const neverIps = await getNeverBlockIps();
    if (neverIps.has(normalizeIp(target.ip))) {
      return {
        protected: true,
        reason: `IP ${target.ip} is trusted (VPS/admin) and cannot be blocked.`,
      };
    }
  }

  if (target.email?.trim()) {
    const neverEmails = await getNeverBlockEmails();
    if (neverEmails.has(normalizeEmail(target.email))) {
      return {
        protected: true,
        reason: `Email ${target.email} belongs to admin/superadmin and cannot be blocked.`,
      };
    }
  }

  if (target.userId?.trim()) {
    const user = await prisma.user.findUnique({
      where: { id: target.userId.trim() },
      select: { role: true, email: true },
    });
    if (user && (user.role === "ADMIN" || user.role === "SUPERADMIN")) {
      return {
        protected: true,
        reason: "Admin/superadmin accounts cannot be blocked.",
      };
    }
  }

  if (target.clerkUserId?.trim()) {
    const user = await prisma.user.findUnique({
      where: { clerkId: target.clerkUserId.trim() },
      select: { role: true },
    });
    if (user && (user.role === "ADMIN" || user.role === "SUPERADMIN")) {
      return {
        protected: true,
        reason: "Admin/superadmin accounts cannot be blocked.",
      };
    }
  }

  return { protected: false };
}

/**
 * Returns first matching active block, if any.
 * Trusted VPS/admin IPs and admin emails never match.
 */
export async function findActiveAccessBlock(target: BlockTarget) {
  const guard = await isProtectedBlockTarget(target);
  if (guard.protected) return null;

  const or: Prisma.AccessBlockWhereInput[] = [];

  if (target.email?.trim()) {
    or.push({ kind: "EMAIL", value: normalizeEmail(target.email) });
  }
  if (target.ip?.trim() && target.ip !== "unknown" && target.ip !== "system") {
    or.push({ kind: "IP", value: normalizeIp(target.ip) });
  }
  if (target.clerkUserId?.trim()) {
    or.push({ kind: "CLERK_ID", value: target.clerkUserId.trim() });
  }
  if (target.userId?.trim()) {
    or.push({ kind: "USER_ID", value: target.userId.trim() });
  }

  if (or.length === 0) return null;

  return prisma.accessBlock.findFirst({
    where: { active: true, OR: or },
    orderBy: { createdAt: "desc" },
  });
}

export async function isAccessBlocked(target: BlockTarget) {
  const block = await findActiveAccessBlock(target);
  return Boolean(block);
}

export type CreateAccessBlockInput = {
  kind: AccessBlockKind;
  value: string;
  reason?: string | null;
  createdBy?: string | null;
};

export async function upsertAccessBlock(input: CreateAccessBlockInput) {
  const value = normalizeBlockValue(input.kind, input.value);
  if (!value) {
    throw new Error("Block value is required.");
  }

  const target: BlockTarget =
    input.kind === "EMAIL"
      ? { email: value }
      : input.kind === "IP"
        ? { ip: value }
        : input.kind === "USER_ID"
          ? { userId: value }
          : { clerkUserId: value };

  const guard = await isProtectedBlockTarget(target);
  if (guard.protected) {
    throw new Error(guard.reason || "This target cannot be blocked.");
  }

  return prisma.accessBlock.upsert({
    where: {
      kind_value: { kind: input.kind, value },
    },
    create: {
      kind: input.kind,
      value,
      reason: input.reason?.trim() || null,
      active: true,
      createdBy: input.createdBy?.trim() || null,
    },
    update: {
      reason: input.reason?.trim() || null,
      active: true,
      createdBy: input.createdBy?.trim() || null,
      revokedAt: null,
      revokedBy: null,
    },
  });
}

/**
 * Ban a local user + mirror EMAIL/CLERK_ID/USER_ID blocks for enforcement.
 */
export async function banUser(params: {
  userId: string;
  reason?: string | null;
  bannedBy?: string | null;
  alsoBlockIp?: string | null;
}) {
  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) {
    throw new Error("User not found.");
  }

  if (user.role === "ADMIN" || user.role === "SUPERADMIN") {
    throw new Error("Cannot ban admin users.");
  }

  if (user.email && getAdminEmailAllowlist().includes(normalizeEmail(user.email))) {
    throw new Error("Cannot ban allowlisted admin email.");
  }

  const reason = params.reason?.trim() || "Banned by admin";
  const bannedBy = params.bannedBy?.trim() || null;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      bannedAt: new Date(),
      banReason: reason,
      bannedBy,
    },
  });

  await upsertAccessBlock({
    kind: "USER_ID",
    value: user.id,
    reason,
    createdBy: bannedBy,
  });

  if (user.clerkId) {
    await upsertAccessBlock({
      kind: "CLERK_ID",
      value: user.clerkId,
      reason,
      createdBy: bannedBy,
    });
  }

  if (user.email) {
    await upsertAccessBlock({
      kind: "EMAIL",
      value: user.email,
      reason,
      createdBy: bannedBy,
    });
  }

  if (params.alsoBlockIp?.trim() && params.alsoBlockIp !== "unknown") {
    try {
      await upsertAccessBlock({
        kind: "IP",
        value: params.alsoBlockIp,
        reason,
        createdBy: bannedBy,
      });
    } catch {
      // Trusted IP — skip silently
    }
  }

  return user;
}

export async function unbanUser(params: {
  userId: string;
  revokedBy?: string | null;
}) {
  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) {
    throw new Error("User not found.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      bannedAt: null,
      banReason: null,
      bannedBy: null,
    },
  });

  const values: Array<{ kind: AccessBlockKind; value: string }> = [
    { kind: "USER_ID", value: user.id },
  ];
  if (user.clerkId) values.push({ kind: "CLERK_ID", value: user.clerkId });
  if (user.email) values.push({ kind: "EMAIL", value: normalizeEmail(user.email) });

  await prisma.accessBlock.updateMany({
    where: {
      active: true,
      OR: values,
    },
    data: {
      active: false,
      revokedAt: new Date(),
      revokedBy: params.revokedBy?.trim() || null,
    },
  });

  return user;
}

/** Unblock by email: revoke EMAIL blocks + clear ban on matching user. */
export async function unbanByEmail(params: {
  email: string;
  revokedBy?: string | null;
}) {
  const email = normalizeEmail(params.email);
  if (!email) throw new Error("Email is required.");

  const revokedBy = params.revokedBy?.trim() || null;

  await prisma.accessBlock.updateMany({
    where: { active: true, kind: "EMAIL", value: email },
    data: {
      active: false,
      revokedAt: new Date(),
      revokedBy,
    },
  });

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await unbanUser({ userId: user.id, revokedBy });
  }

  return { email, userId: user?.id || null };
}

export async function revokeAccessBlock(params: {
  id: string;
  revokedBy?: string | null;
}) {
  return prisma.accessBlock.update({
    where: { id: params.id },
    data: {
      active: false,
      revokedAt: new Date(),
      revokedBy: params.revokedBy?.trim() || null,
    },
  });
}

export function isStaffRole(role: Role) {
  return role === "ADMIN" || role === "SUPERADMIN";
}
