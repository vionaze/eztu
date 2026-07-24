/**
 * Admin: list / create / revoke access blocks (ban IP, email, user).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma, type AccessBlockKind } from "@kupon/db";
import {
  AuthenticationRequiredError,
  AuthorizationRequiredError,
  requireAdminUser,
} from "@/lib/clerk";
import {
  banUser,
  revokeAccessBlock,
  unbanUser,
  upsertAccessBlock,
} from "@/lib/access-block";
import { writeAppLog } from "@/lib/app-log";

const KINDS = new Set<AccessBlockKind>(["EMAIL", "IP", "CLERK_ID", "USER_ID"]);

export async function GET() {
  try {
    await requireAdminUser();

    const [blocks, recentEvents] = await Promise.all([
      prisma.accessBlock.findMany({
        where: { active: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.securityEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    return NextResponse.json({ blocks, recentEvents });
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof AuthorizationRequiredError
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[Admin Security Blocks GET]", error);
    return NextResponse.json({ error: "Failed to load blocks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminUser();
    const body = (await request.json()) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "block";
    const reason =
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : "Blocked by admin";
    const actor = admin.email || admin.dbUserId;

    if (action === "ban_user") {
      const userId = typeof body.userId === "string" ? body.userId.trim() : "";
      if (!userId) {
        return NextResponse.json({ error: "userId required" }, { status: 400 });
      }
      const alsoBlockIp =
        typeof body.ip === "string" ? body.ip.trim() : null;

      await banUser({
        userId,
        reason,
        bannedBy: actor,
        alsoBlockIp,
      });

      await writeAppLog({
        category: "SECURITY",
        level: "WARNING",
        title: `User banned · ${userId.slice(0, 12)}…`,
        message: reason,
        actor,
        route: "/api/admin/security/blocks",
        metadata: { userId, alsoBlockIp },
      });

      return NextResponse.json({ ok: true });
    }

    if (action === "unban_user") {
      const userId = typeof body.userId === "string" ? body.userId.trim() : "";
      if (!userId) {
        return NextResponse.json({ error: "userId required" }, { status: 400 });
      }
      await unbanUser({ userId, revokedBy: actor });
      await writeAppLog({
        category: "SECURITY",
        level: "INFO",
        title: `User unbanned · ${userId.slice(0, 12)}…`,
        message: "Access restored",
        actor,
        route: "/api/admin/security/blocks",
        metadata: { userId },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "revoke") {
      const id = typeof body.id === "string" ? body.id.trim() : "";
      if (!id) {
        return NextResponse.json({ error: "id required" }, { status: 400 });
      }
      await revokeAccessBlock({ id, revokedBy: actor });
      await writeAppLog({
        category: "SECURITY",
        level: "INFO",
        title: "Access block revoked",
        message: id,
        actor,
        route: "/api/admin/security/blocks",
      });
      return NextResponse.json({ ok: true });
    }

    // Default: create block by kind+value
    const kindRaw = typeof body.kind === "string" ? body.kind.toUpperCase() : "";
    const value = typeof body.value === "string" ? body.value.trim() : "";
    if (!KINDS.has(kindRaw as AccessBlockKind) || !value) {
      return NextResponse.json(
        { error: "kind (EMAIL|IP|CLERK_ID|USER_ID) and value required" },
        { status: 400 }
      );
    }

    const kind = kindRaw as AccessBlockKind;
    const block = await upsertAccessBlock({
      kind,
      value,
      reason,
      createdBy: actor,
    });

    // If USER_ID, also mark User.bannedAt
    if (kind === "USER_ID") {
      try {
        await banUser({
          userId: value,
          reason,
          bannedBy: actor,
          alsoBlockIp: typeof body.ip === "string" ? body.ip : null,
        });
      } catch {
        // USER_ID may be synthetic; block row is enough
      }
    }

    await writeAppLog({
      category: "SECURITY",
      level: "WARNING",
      title: `Access block · ${kind}`,
      message: `${value} — ${reason}`,
      actor,
      route: "/api/admin/security/blocks",
      metadata: { kind, value },
    });

    return NextResponse.json({ ok: true, block });
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof AuthorizationRequiredError
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Failed to update block";
    console.error("[Admin Security Blocks POST]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
