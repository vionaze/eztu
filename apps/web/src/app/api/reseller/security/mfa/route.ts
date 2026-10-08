import { NextResponse } from "next/server";
import { AccountBannedError, AuthenticationRequiredError } from "@/lib/clerk";
import { getCurrentResellerContext } from "@/lib/reseller-auth";
import { getResellerMfaStatus } from "@/lib/reseller-mfa";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { authenticatedUser: authenticated, memberships } = await getCurrentResellerContext();
    if (!memberships.some(({ organization }) => organization.status === "ACTIVE")) {
      return NextResponse.json({ error: "Active reseller membership required." }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
    }
    const mfa = await getResellerMfaStatus();
    return NextResponse.json(
      { ...mfa, email: authenticated.email },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
    }
    if (error instanceof AccountBannedError) {
      return NextResponse.json({ error: "Access denied" }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("[reseller/security/mfa GET]", error);
    return NextResponse.json({ error: "Unable to load security status" }, { status: 503 });
  }
}
