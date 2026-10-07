import { NextResponse } from "next/server";
import { prisma } from "@kupon/db";
import { requirePlatformAdminForResellers } from "@/lib/reseller-auth";
import { AuthenticationRequiredError, AuthorizationRequiredError } from "@/lib/clerk";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requirePlatformAdminForResellers();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const organizations = await prisma.resellerOrganization.findMany({
      where: status && ["PENDING", "ACTIVE", "REJECTED", "SUSPENDED"].includes(status)
        ? { status: status as "PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED" }
        : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        members: {
          where: { active: true },
          orderBy: { createdAt: "asc" },
          take: 10,
          select: {
            id: true,
            role: true,
            active: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        _count: { select: { members: true } },
      },
    });

    return NextResponse.json({ organizations });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (error instanceof AuthorizationRequiredError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[admin/resellers GET]", error);
    return NextResponse.json({ error: "Unable to load resellers" }, { status: 500 });
  }
}
