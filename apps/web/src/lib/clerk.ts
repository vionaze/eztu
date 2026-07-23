import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma, type Role, type User } from "@kupon/db";

type ClerkUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

export class AuthenticationRequiredError extends Error {
  constructor(message = "Authentication is required.") {
    super(message);
    this.name = "AuthenticationRequiredError";
  }
}

export class AuthorizationRequiredError extends Error {
  constructor(message = "You are not allowed to access this resource.") {
    super(message);
    this.name = "AuthorizationRequiredError";
  }
}

export type AuthenticatedClerkUser = {
  clerkUserId: string;
  dbUserId: string;
  dbUser: User;
  email: string | null;
  walletAddress: string | null;
  role: Role;
};

function getPrimaryEmail(clerkUser: ClerkUser) {
  return clerkUser.primaryEmailAddress?.emailAddress.toLowerCase() ?? null;
}

function getDisplayName(clerkUser: ClerkUser) {
  return (
    clerkUser.fullName ||
    clerkUser.username ||
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
    null
  );
}

function getPrimaryWallet(clerkUser: ClerkUser) {
  const wallet =
    clerkUser.primaryWeb3Wallet?.web3Wallet ||
    clerkUser.web3Wallets[0]?.web3Wallet ||
    null;

  return wallet?.toLowerCase() ?? null;
}

/**
 * Sync Clerk identity into local User.
 * Prefer clerkId match; if missing, link existing row by email so ADMIN/SUPERADMIN is preserved.
 */
async function syncClerkUser(clerkUser: ClerkUser) {
  const email = getPrimaryEmail(clerkUser);
  const walletAddress = getPrimaryWallet(clerkUser);
  const name = getDisplayName(clerkUser);
  const image = clerkUser.imageUrl || null;

  const byClerkId = await prisma.user.findUnique({
    where: { clerkId: clerkUser.id },
  });

  if (byClerkId) {
    try {
      return await prisma.user.update({
        where: { id: byClerkId.id },
        data: {
          name,
          email,
          image,
          walletAddress,
        },
      });
    } catch (error) {
      // Unique email conflict: keep role, skip email update
      console.error("[Clerk] Update by clerkId failed, updating non-unique fields", error);
      return prisma.user.update({
        where: { id: byClerkId.id },
        data: { name, image },
      });
    }
  }

  // No row for this clerkId yet — link existing account by email (preserves SUPERADMIN/ADMIN).
  if (email) {
    const byEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (byEmail) {
      try {
        return await prisma.user.update({
          where: { id: byEmail.id },
          data: {
            clerkId: clerkUser.id,
            name,
            image,
            walletAddress,
          },
        });
      } catch (error) {
        console.error("[Clerk] Relink by email failed", error);
        // clerkId may already be taken by a stub USER row — merge carefully
        const stub = await prisma.user.findUnique({
          where: { clerkId: clerkUser.id },
        });
        if (stub && stub.id !== byEmail.id) {
          // Stub owns this clerkId (USER). Copy admin role from the email row
          // without moving email (unique). Prefer this session's row for auth.
          return prisma.user.update({
            where: { id: stub.id },
            data: {
              name,
              image,
              walletAddress,
              role: byEmail.role,
            },
          });
        }
        throw error;
      }
    }
  }

  // Brand-new user
  try {
    return await prisma.user.create({
      data: {
        clerkId: clerkUser.id,
        name,
        email,
        image,
        walletAddress,
      },
    });
  } catch (error) {
    console.error("[Clerk] Create user failed, retry without unique fields", error);
    return prisma.user.create({
      data: {
        clerkId: clerkUser.id,
        name,
        image,
      },
    });
  }
}

export async function requireClerkUser(): Promise<AuthenticatedClerkUser> {
  const { userId } = await auth();

  if (!userId) {
    throw new AuthenticationRequiredError();
  }

  const clerkUser = await currentUser();

  if (!clerkUser || clerkUser.id !== userId) {
    throw new AuthenticationRequiredError("Unable to verify the active Clerk user.");
  }

  const dbUser = await syncClerkUser(clerkUser);

  return {
    clerkUserId: clerkUser.id,
    dbUserId: dbUser.id,
    dbUser,
    email: dbUser.email,
    walletAddress: dbUser.walletAddress,
    role: dbUser.role,
  };
}

export async function requireAdminUser() {
  const authenticatedUser = await requireClerkUser();

  if (!isAdminRole(authenticatedUser.role)) {
    console.warn("[Admin] Forbidden", {
      clerkUserId: authenticatedUser.clerkUserId,
      dbUserId: authenticatedUser.dbUserId,
      email: authenticatedUser.email,
      role: authenticatedUser.role,
    });
    throw new AuthorizationRequiredError();
  }

  return authenticatedUser;
}

export function isAdminRole(role: Role) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

export async function requireSuperAdminUser() {
  const authenticatedUser = await requireClerkUser();

  if (authenticatedUser.role !== "SUPERADMIN") {
    throw new AuthorizationRequiredError("Superadmin access is required.");
  }

  return authenticatedUser;
}
