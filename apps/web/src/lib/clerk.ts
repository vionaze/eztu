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

async function syncClerkUser(clerkUser: ClerkUser) {
  const email = getPrimaryEmail(clerkUser);
  const walletAddress = getPrimaryWallet(clerkUser);
  const name = getDisplayName(clerkUser);
  const image = clerkUser.imageUrl || null;

  try {
    return await prisma.user.upsert({
      where: { clerkId: clerkUser.id },
      update: {
        name,
        email,
        image,
        walletAddress,
      },
      create: {
        clerkId: clerkUser.id,
        name,
        email,
        image,
        walletAddress,
      },
    });
  } catch (error) {
    // Unique email/wallet conflicts must not 500 account pages for a valid Clerk session.
    console.error("[Clerk] Full user sync failed, retrying without unique fields", error);

    try {
      return await prisma.user.upsert({
        where: { clerkId: clerkUser.id },
        update: {
          name,
          image,
        },
        create: {
          clerkId: clerkUser.id,
          name,
          image,
          // leave email/wallet null on conflict so the page can still load
        },
      });
    } catch (retryError) {
      console.error("[Clerk] Minimal user sync failed", retryError);
      // Last resort: return existing row by clerkId if present
      const existing = await prisma.user.findUnique({
        where: { clerkId: clerkUser.id },
      });
      if (existing) return existing;
      throw retryError;
    }
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
