import "server-only";

import { prisma, type ResellerMemberRole, type ResellerOrganizationStatus } from "@kupon/db";
import {
  AuthorizationRequiredError,
  AuthenticationRequiredError,
  isAdminRole,
  requireClerkUser,
} from "@/lib/clerk";

export { AuthenticationRequiredError, AuthorizationRequiredError };

export async function getResellerMemberships(userId: string) {
  return prisma.resellerOrganizationMember.findMany({
    where: { userId, active: true },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getCurrentResellerContext() {
  const authenticatedUser = await requireClerkUser();
  const memberships = await getResellerMemberships(authenticatedUser.dbUserId);
  return { authenticatedUser, memberships };
}

export async function requireResellerUser(options?: {
  organizationId?: string;
  roles?: ResellerMemberRole[];
  statuses?: ResellerOrganizationStatus[];
}) {
  const { authenticatedUser, memberships } = await getCurrentResellerContext();
  const membership = memberships.find(
    (item) =>
      (!options?.organizationId || item.organizationId === options.organizationId) &&
      (!options?.roles || options.roles.includes(item.role)) &&
      (!options?.statuses || options.statuses.includes(item.organization.status)),
  );

  if (!membership) {
    throw new AuthorizationRequiredError(
      "An active reseller organization membership is required.",
    );
  }

  return { authenticatedUser, membership, organization: membership.organization };
}

export async function requireResellerOwner(organizationId?: string) {
  return requireResellerUser({
    organizationId,
    roles: ["OWNER"],
    statuses: ["ACTIVE"],
  });
}

export async function requirePlatformAdminForResellers() {
  const authenticatedUser = await requireClerkUser();
  if (!isAdminRole(authenticatedUser.role, authenticatedUser.email)) {
    throw new AuthorizationRequiredError("Platform admin access is required.");
  }
  return authenticatedUser;
}
