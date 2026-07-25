/**
 * PATCH  /api/admin/members/:id — update name/email/role/wallet
 * DELETE /api/admin/members/:id — delete if no orders
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma, type Role } from "@kupon/db";
import {
  AuthenticationRequiredError,
  AuthorizationRequiredError,
  isAdminEmail,
  requireAdminUser,
} from "@/lib/clerk";
import { unbanUser } from "@/lib/access-block";
import { writeAppLog } from "@/lib/app-log";

const ROLES = new Set<Role>(["USER", "ADMIN", "SUPERADMIN"]);

function canManageRoles(actor: { role: Role; email: string | null }) {
  return actor.role === "SUPERADMIN" || isAdminEmail(actor.email);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminUser();
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Non-superadmin cannot edit staff
    if (
      isStaff(existing.role) &&
      !canManageRoles(admin) &&
      existing.id !== admin.dbUserId
    ) {
      return NextResponse.json(
        { error: "Only SUPERADMIN can edit admin members" },
        { status: 403 }
      );
    }

    const data: {
      name?: string | null;
      email?: string | null;
      walletAddress?: string | null;
      role?: Role;
      bannedAt?: Date | null;
      banReason?: string | null;
      bannedBy?: string | null;
    } = {};

    if ("name" in body) {
      data.name =
        typeof body.name === "string" ? body.name.trim() || null : null;
    }

    if ("email" in body) {
      const email =
        typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "Invalid email" }, { status: 400 });
      }
      if (email && email !== existing.email) {
        const clash = await prisma.user.findUnique({ where: { email } });
        if (clash && clash.id !== id) {
          return NextResponse.json(
            { error: "Email already in use" },
            { status: 409 }
          );
        }
      }
      data.email = email || null;
    }

    if ("walletAddress" in body) {
      data.walletAddress =
        typeof body.walletAddress === "string"
          ? body.walletAddress.trim().toLowerCase() || null
          : null;
    }

    if ("role" in body && typeof body.role === "string") {
      const nextRole = body.role.toUpperCase() as Role;
      if (!ROLES.has(nextRole)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }

      if (nextRole !== existing.role) {
        if (!canManageRoles(admin)) {
          return NextResponse.json(
            { error: "Only SUPERADMIN can change roles" },
            { status: 403 }
          );
        }

        // Prevent self-demote if last SUPERADMIN
        if (
          existing.role === "SUPERADMIN" &&
          nextRole !== "SUPERADMIN" &&
          existing.id === admin.dbUserId
        ) {
          const superCount = await prisma.user.count({
            where: { role: "SUPERADMIN" },
          });
          if (superCount <= 1 && !isAdminEmail(admin.email)) {
            return NextResponse.json(
              { error: "Cannot demote the last SUPERADMIN" },
              { status: 400 }
            );
          }
        }

        data.role = nextRole;
      }
    }

    // Optional clear ban from members UI
    if (body.clearBan === true) {
      await unbanUser({
        userId: id,
        revokedBy: admin.email || admin.dbUserId,
      });
    }

    const member = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        clerkId: true,
        name: true,
        email: true,
        image: true,
        walletAddress: true,
        role: true,
        lastSeenIp: true,
        lastSeenAt: true,
        bannedAt: true,
        banReason: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { orders: true } },
      },
    });

    await writeAppLog({
      category: "ADMIN",
      level: "INFO",
      title: `Member updated · ${member.email || member.id.slice(0, 8)}`,
      message: Object.keys(data).join(", ") || "clearBan",
      actor: admin.email || admin.dbUserId,
      route: `/api/admin/members/${id}`,
      metadata: { userId: id, fields: Object.keys(data) },
    });

    return NextResponse.json({ member });
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof AuthorizationRequiredError
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[Admin Members PATCH]", error);
    return NextResponse.json({ error: "Failed to update member" }, { status: 500 });
  }
}

function isStaff(role: Role) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminUser();
    const { id } = await context.params;

    if (id === admin.dbUserId) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (isStaff(existing.role) && !canManageRoles(admin)) {
      return NextResponse.json(
        { error: "Only SUPERADMIN can delete admin members" },
        { status: 403 }
      );
    }

    if (existing._count.orders > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete member with ${existing._count.orders} order(s). Ban them instead.`,
        },
        { status: 409 }
      );
    }

    await prisma.accessBlock.updateMany({
      where: {
        active: true,
        OR: [
          { kind: "USER_ID", value: id },
          ...(existing.email
            ? [{ kind: "EMAIL" as const, value: existing.email.toLowerCase() }]
            : []),
          { kind: "CLERK_ID", value: existing.clerkId },
        ],
      },
      data: {
        active: false,
        revokedAt: new Date(),
        revokedBy: admin.email || admin.dbUserId,
      },
    });

    await prisma.user.delete({ where: { id } });

    await writeAppLog({
      category: "ADMIN",
      level: "WARNING",
      title: `Member deleted · ${existing.email || id.slice(0, 8)}`,
      message: existing.role,
      actor: admin.email || admin.dbUserId,
      route: `/api/admin/members/${id}`,
      metadata: { userId: id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof AuthorizationRequiredError
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[Admin Members DELETE]", error);
    return NextResponse.json({ error: "Failed to delete member" }, { status: 500 });
  }
}
