import "server-only";
import { prisma, type AccessBlockKind, type Prisma } from "@kupon/db";

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

export function normalizeBlockValue(kind: AccessBlockKind, value: string) {
  const trimmed = value.trim();
  if (kind === "EMAIL") return normalizeEmail(trimmed);
  if (kind === "IP") return normalizeIp(trimmed);
  return trimmed;
}

/**
 * Returns first matching active block, if any.
 */
export async function findActiveAccessBlock(target: BlockTarget) {
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
    await upsertAccessBlock({
      kind: "IP",
      value: params.alsoBlockIp,
      reason,
      createdBy: bannedBy,
    });
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
