import { NextResponse } from "next/server";
import { prisma } from "@kupon/db";
import { requirePlatformAdminForResellers } from "@/lib/reseller-auth";
import { AuthenticationRequiredError, AuthorizationRequiredError } from "@/lib/clerk";
import { writeAppLog } from "@/lib/app-log";
import { canTransitionResellerStatus } from "@/lib/reseller-utils";

type RouteContext = { params: Promise<{ id: string }> };

const statuses = ["PENDING", "ACTIVE", "REJECTED", "SUSPENDED"] as const;
const tiers = ["TIER_1", "TIER_2"] as const;

type Status = (typeof statuses)[number];
type Tier = (typeof tiers)[number];

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requirePlatformAdminForResellers();
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      status?: string;
      tier?: string;
      rejectionReason?: string | null;
    };

    const existing = await prisma.resellerOrganization.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Reseller not found" }, { status: 404 });

    const data: {
      status?: Status;
      tier?: Tier;
      rejectionReason?: string | null;
      suspendedAt?: Date | null;
      suspendedBy?: string | null;
    } = {};

    if (body.status !== undefined) {
      if (!statuses.includes(body.status as Status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      data.status = body.status as Status;
      if (!canTransitionResellerStatus(existing.status, data.status)) {
        return NextResponse.json(
          { error: `Cannot change status from ${existing.status} to ${data.status}.` },
          { status: 409 },
        );
      }
      if (data.status === "SUSPENDED") {
        data.suspendedAt = new Date();
        data.suspendedBy = admin.dbUserId;
      } else {
        data.suspendedAt = null;
        data.suspendedBy = null;
      }
    }

    if (body.tier !== undefined) {
      if (!tiers.includes(body.tier as Tier)) {
        return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
      }
      data.tier = body.tier as Tier;
    }

    if (body.rejectionReason !== undefined) {
      data.rejectionReason = body.rejectionReason
        ? String(body.rejectionReason).trim().slice(0, 500)
        : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No changes supplied" }, { status: 400 });
    }

    const organization = await prisma.resellerOrganization.update({
      where: { id },
      data,
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

    await writeAppLog({
      category: "ADMIN",
      level: "WARNING",
      title: `Reseller organization updated: ${organization.name}`,
      actor: admin.email || admin.dbUserId,
      route: `/api/admin/resellers/${id}`,
      metadata: { organizationId: id, changes: data },
    });

    return NextResponse.json({ organization });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (error instanceof AuthorizationRequiredError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[admin/resellers PATCH]", error);
    return NextResponse.json({ error: "Unable to update reseller" }, { status: 500 });
  }
}
