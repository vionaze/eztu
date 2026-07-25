import { prisma } from "@kupon/db";
import { Card } from "@kupon/ui";
import {
  isAdminEmail,
  requireAdminUser,
} from "@/lib/clerk";
import MembersManager from "./MembersManager";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  const admin = await requireAdminUser();
  const canManageRoles =
    admin.role === "SUPERADMIN" || isAdminEmail(admin.email);

  const members = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      clerkId: true,
      name: true,
      email: true,
      image: true,
      walletAddress: true,
      role: true,
      lastSeenIp: true,
      lastSeenUserAgent: true,
      lastSeenAt: true,
      bannedAt: true,
      banReason: true,
      bannedBy: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { orders: true } },
    },
  });

  return (
    <>
      <Card padding="sm" className="space-y-1 !p-3 sm:!p-3.5">
        <h2 className="text-[13px] font-semibold text-text-primary">Members</h2>
        <p className="admin-hint max-w-3xl">
          All registered profiles (Clerk-linked + local). Edit name/email/wallet,
          change role (USER / ADMIN / SUPERADMIN), ban/unban, or delete members
          without orders. Staff role changes require SUPERADMIN.
        </p>
      </Card>

      <MembersManager
        initialMembers={members.map((m) => ({
          ...m,
          lastSeenAt: m.lastSeenAt?.toISOString() ?? null,
          bannedAt: m.bannedAt?.toISOString() ?? null,
          createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt.toISOString(),
        }))}
        canManageRoles={canManageRoles}
        currentUserId={admin.dbUserId}
      />
    </>
  );
}
