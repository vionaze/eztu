import { requireAdminUser } from "@/lib/clerk";
import { prisma } from "@kupon/db";
import ResellersManager from "./ResellersManager";

export const dynamic = "force-dynamic";

export default async function AdminResellersPage() {
  await requireAdminUser();
  const organizations = await prisma.resellerOrganization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      members: {
        where: { active: true },
        orderBy: { createdAt: "asc" },
        take: 5,
        select: {
          id: true,
          role: true,
          user: { select: { email: true, name: true } },
        },
      },
      _count: { select: { members: true } },
    },
  });

  return (
    <ResellersManager
      initialOrganizations={organizations.map((organization) => ({
        ...organization,
        createdAt: organization.createdAt.toISOString(),
        updatedAt: organization.updatedAt.toISOString(),
        suspendedAt: organization.suspendedAt?.toISOString() || null,
      }))}
    />
  );
}
