import { NextResponse } from "next/server";
import {
  AuthenticationRequiredError,
  isAdminRole,
  requireClerkUser,
} from "@/lib/clerk";

export const dynamic = "force-dynamic";

/**
 * Current signed-in app user (DB role). Used by navbar to show Admin link.
 */
export async function GET() {
  try {
    const user = await requireClerkUser();

    return NextResponse.json({
      email: user.email,
      role: user.role,
      isAdmin: isAdminRole(user.role, user.email),
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { email: null, role: null, isAdmin: false },
        { status: 401 }
      );
    }

    console.error("[account/me]", error);
    return NextResponse.json(
      { email: null, role: null, isAdmin: false },
      { status: 500 }
    );
  }
}
