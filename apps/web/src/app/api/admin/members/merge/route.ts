/**
 * POST /api/admin/members/merge
 * Body: { survivorId, donorId } OR { email } to auto-find duplicates for that email
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@kupon/db";
import {
  AuthenticationRequiredError,
  AuthorizationRequiredError,
  isAdminEmail,
  requireAdminUser,
} from "@/lib/clerk";
import { mergeUserIntoSurvivor } from "@/lib/merge-users";
import { writeAppLog } from "@/lib/app-log";

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (admin.role !== "SUPERADMIN" && !isAdminEmail(admin.email)) {
      return NextResponse.json(
        { error: "Only SUPERADMIN can merge members" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    let survivorId =
      typeof body.survivorId === "string" ? body.survivorId.trim() : "";
    let donorId = typeof body.donorId === "string" ? body.donorId.trim() : "";

    // Convenience: merge by email — keep row that has this clerk session or most data
    if ((!survivorId || !donorId) && typeof body.email === "string") {
      const email = body.email.trim().toLowerCase();
      const withEmail = await prisma.user.findUnique({ where: { email } });
      if (!withEmail) {
        return NextResponse.json(
          { error: "No member with that email" },
          { status: 404 }
        );
      }
      // Find same-name empty-email superadmins (common dual pattern)
      const siblings = await prisma.user.findMany({
        where: {
          id: { not: withEmail.id },
          OR: [
            { name: withEmail.name || undefined },
            { lastSeenIp: withEmail.lastSeenIp || undefined },
          ],
          email: null,
        },
        take: 5,
      });
      const donor =
        siblings.find((s) => s.role === withEmail.role) || siblings[0];
      if (!donor) {
        return NextResponse.json(
          { error: "No duplicate row found for that email" },
          { status: 404 }
        );
      }
      // Prefer current admin session as survivor if one of the rows is them
      if (admin.dbUserId === withEmail.id || admin.dbUserId === donor.id) {
        survivorId = admin.dbUserId;
        donorId =
          admin.dbUserId === withEmail.id ? donor.id : withEmail.id;
      } else {
        survivorId = withEmail.id;
        donorId = donor.id;
      }
    }

    if (!survivorId || !donorId) {
      return NextResponse.json(
        { error: "survivorId and donorId required (or email)" },
        { status: 400 }
      );
    }

    const merged = await mergeUserIntoSurvivor({ survivorId, donorId });

    await writeAppLog({
      category: "ADMIN",
      level: "WARNING",
      title: `Members merged → ${merged.email || merged.id.slice(0, 8)}`,
      message: `survivor=${survivorId} donor=${donorId}`,
      actor: admin.email || admin.dbUserId,
      route: "/api/admin/members/merge",
      metadata: { survivorId, donorId, mergedId: merged.id },
    });

    return NextResponse.json({
      ok: true,
      member: merged,
      survivorId: merged.id,
      donorId,
    });
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof AuthorizationRequiredError
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const message =
      error instanceof Error ? error.message : "Merge failed";
    console.error("[Admin Members Merge]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
