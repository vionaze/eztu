/**
 * GET  /api/admin/members — list members
 * POST /api/admin/members — create member (local profile)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma, type Role } from "@kupon/db";
import { randomBytes } from "node:crypto";
import {
  AuthenticationRequiredError,
  AuthorizationRequiredError,
  isAdminEmail,
  requireAdminUser,
} from "@/lib/clerk";
import { writeAppLog } from "@/lib/app-log";

const ROLES = new Set<Role>(["USER", "ADMIN", "SUPERADMIN"]);

function canManageRoles(actor: {
  role: Role;
  email: string | null;
}) {
  return actor.role === "SUPERADMIN" || isAdminEmail(actor.email);
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser();
    const q = request.nextUrl.searchParams.get("q")?.trim() || "";
    const roleFilter = request.nextUrl.searchParams.get("role")?.toUpperCase();

    const members = await prisma.user.findMany({
      where: {
        ...(roleFilter && ROLES.has(roleFilter as Role)
          ? { role: roleFilter as Role }
          : {}),
        ...(q
          ? {
              OR: [
                { email: { contains: q, mode: "insensitive" } },
                { name: { contains: q, mode: "insensitive" } },
                { id: { contains: q } },
                { clerkId: { contains: q } },
              ],
            }
          : {}),
      },
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

    return NextResponse.json({ members });
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof AuthorizationRequiredError
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[Admin Members GET]", error);
    return NextResponse.json({ error: "Failed to load members" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminUser();
    const body = (await request.json()) as Record<string, unknown>;

    const emailRaw =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const name =
      typeof body.name === "string" ? body.name.trim() || null : null;
    const roleRaw =
      typeof body.role === "string" ? body.role.toUpperCase() : "USER";
    const role = ROLES.has(roleRaw as Role) ? (roleRaw as Role) : "USER";

    if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    if ((role === "ADMIN" || role === "SUPERADMIN") && !canManageRoles(admin)) {
      return NextResponse.json(
        { error: "Only SUPERADMIN can create admin members" },
        { status: 403 }
      );
    }

    if (role === "SUPERADMIN" && !canManageRoles(admin)) {
      return NextResponse.json(
        { error: "Only SUPERADMIN can create SUPERADMIN" },
        { status: 403 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email: emailRaw } });
    if (existing) {
      return NextResponse.json(
        { error: "A member with this email already exists" },
        { status: 409 }
      );
    }

    // Local profile; links to Clerk on first sign-in with same email
    const clerkId = `local_${randomBytes(12).toString("hex")}`;

    const member = await prisma.user.create({
      data: {
        clerkId,
        email: emailRaw,
        name,
        role: role === "USER" || canManageRoles(admin) ? role : "USER",
      },
    });

    await writeAppLog({
      category: "ADMIN",
      level: "SUCCESS",
      title: `Member created · ${emailRaw}`,
      message: `role=${member.role}`,
      actor: admin.email || admin.dbUserId,
      route: "/api/admin/members",
      metadata: { userId: member.id, role: member.role },
    });

    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof AuthorizationRequiredError
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[Admin Members POST]", error);
    return NextResponse.json({ error: "Failed to create member" }, { status: 500 });
  }
}
