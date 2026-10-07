import { NextResponse } from "next/server";
import { getCurrentResellerContext } from "@/lib/reseller-auth";
import { AuthenticationRequiredError } from "@/lib/clerk";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { authenticatedUser, memberships } = await getCurrentResellerContext();
    return NextResponse.json({
      user: {
        id: authenticatedUser.dbUserId,
        email: authenticatedUser.email,
        emailVerified: authenticatedUser.emailVerified,
      },
      memberships: memberships.map(({ organization, organizationId }) => ({
        organizationId,
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          status: organization.status,
          rejectionReason: organization.rejectionReason,
          createdAt: organization.createdAt,
        },
      })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    console.error("[reseller/me GET]", error);
    return NextResponse.json({ error: "Unable to load reseller status" }, { status: 500 });
  }
}
