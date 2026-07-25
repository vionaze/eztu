import "server-only";
import { prisma, type Role, type User } from "@kupon/db";

const roleRank: Record<Role, number> = {
  USER: 1,
  ADMIN: 2,
  SUPERADMIN: 3,
};

function pickHigherRole(a: Role, b: Role): Role {
  return roleRank[a] >= roleRank[b] ? a : b;
}

export function isSyntheticClerkId(clerkId: string) {
  return (
    clerkId.startsWith("local_") ||
    clerkId.startsWith("pending_") ||
    clerkId.startsWith("merge_")
  );
}

/**
 * Merge donor user into survivor.
 * - Reassigns orders + security events
 * - Moves email/name/role carefully (unique constraints)
 * - Deletes donor row
 */
export async function mergeUserIntoSurvivor(params: {
  survivorId: string;
  donorId: string;
}) {
  if (params.survivorId === params.donorId) {
    throw new Error("Cannot merge a user into itself.");
  }

  return prisma.$transaction(async (tx) => {
    const survivor = await tx.user.findUnique({
      where: { id: params.survivorId },
    });
    const donor = await tx.user.findUnique({ where: { id: params.donorId } });

    if (!survivor || !donor) {
      throw new Error("Survivor or donor user not found.");
    }

    const donorClerkOriginal = donor.clerkId;
    const survivorClerkOriginal = survivor.clerkId;
    const donorEmail = donor.email;
    const donorWallet = donor.walletAddress;

    // Free unique fields on donor so survivor can claim them
    await tx.user.update({
      where: { id: donor.id },
      data: {
        email: null,
        walletAddress: null,
        clerkId: `merge_${donor.id}_${Date.now()}`,
      },
    });

    // Prefer a real Clerk id on the surviving row
    let nextClerkId = survivorClerkOriginal;
    if (
      isSyntheticClerkId(survivorClerkOriginal) &&
      !isSyntheticClerkId(donorClerkOriginal)
    ) {
      nextClerkId = donorClerkOriginal;
    }

    const nextEmail = survivor.email || donorEmail;
    const nextWallet = survivor.walletAddress || donorWallet;
    const nextName = survivor.name || donor.name;
    const nextImage = survivor.image || donor.image;
    const nextRole = pickHigherRole(survivor.role, donor.role);
    const nextBannedAt = survivor.bannedAt || donor.bannedAt;
    const nextBanReason = survivor.banReason || donor.banReason;
    const nextBannedBy = survivor.bannedBy || donor.bannedBy;
    const nextLastSeenIp = survivor.lastSeenIp || donor.lastSeenIp;
    const nextLastSeenUa =
      survivor.lastSeenUserAgent || donor.lastSeenUserAgent;
    const nextLastSeenAt =
      survivor.lastSeenAt && donor.lastSeenAt
        ? survivor.lastSeenAt > donor.lastSeenAt
          ? survivor.lastSeenAt
          : donor.lastSeenAt
        : survivor.lastSeenAt || donor.lastSeenAt;

    await tx.order.updateMany({
      where: { userId: donor.id },
      data: { userId: survivor.id },
    });

    await tx.securityEvent.updateMany({
      where: { userId: donor.id },
      data: { userId: survivor.id },
    });

    // USER_ID access blocks: retarget to survivor (unique kind+value may conflict)
    const donorUserBlocks = await tx.accessBlock.findMany({
      where: { kind: "USER_ID", value: donor.id },
    });
    for (const block of donorUserBlocks) {
      const existing = await tx.accessBlock.findUnique({
        where: { kind_value: { kind: "USER_ID", value: survivor.id } },
      });
      if (existing) {
        await tx.accessBlock.delete({ where: { id: block.id } });
      } else {
        await tx.accessBlock.update({
          where: { id: block.id },
          data: { value: survivor.id },
        });
      }
    }

    if (donorEmail) {
      await tx.accessBlock.updateMany({
        where: { kind: "EMAIL", value: donorEmail.toLowerCase() },
        data: { value: (nextEmail || donorEmail).toLowerCase() },
      });
    }

    const merged = await tx.user.update({
      where: { id: survivor.id },
      data: {
        clerkId: nextClerkId,
        email: nextEmail,
        walletAddress: nextWallet,
        name: nextName,
        image: nextImage,
        role: nextRole,
        bannedAt: nextBannedAt,
        banReason: nextBanReason,
        bannedBy: nextBannedBy,
        lastSeenIp: nextLastSeenIp,
        lastSeenUserAgent: nextLastSeenUa,
        lastSeenAt: nextLastSeenAt,
      },
    });

    await tx.user.delete({ where: { id: donor.id } });

    return merged;
  });
}

/**
 * When login session row and email-owner row differ, merge into the active session.
 * Keeps real Clerk id so the user stays logged in against the same row.
 */
export async function mergeClerkEmailConflict(params: {
  sessionUser: User;
  emailOwner: User;
}): Promise<User> {
  if (params.sessionUser.id === params.emailOwner.id) {
    return params.sessionUser;
  }

  // Active login always wins as survivor when it has a real clerkId
  if (!isSyntheticClerkId(params.sessionUser.clerkId)) {
    return mergeUserIntoSurvivor({
      survivorId: params.sessionUser.id,
      donorId: params.emailOwner.id,
    });
  }

  // Session is synthetic — prefer email owner if it has real clerk id
  if (!isSyntheticClerkId(params.emailOwner.clerkId)) {
    return mergeUserIntoSurvivor({
      survivorId: params.emailOwner.id,
      donorId: params.sessionUser.id,
    });
  }

  // Both synthetic: keep older / email owner as survivor
  return mergeUserIntoSurvivor({
    survivorId: params.emailOwner.id,
    donorId: params.sessionUser.id,
  });
}
