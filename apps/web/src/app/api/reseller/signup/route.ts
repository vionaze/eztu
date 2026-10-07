import { NextResponse } from "next/server";
import { prisma } from "@kupon/db";
import { requireClerkUser, AuthenticationRequiredError } from "@/lib/clerk";
import { slugifyReseller } from "@/lib/reseller-utils";
import { writeAppLog } from "@/lib/app-log";
import { sendDiscordResellerApplication } from "@/lib/discord";

export const dynamic = "force-dynamic";

function publicOrganization(organization: { id: string; name: string; slug: string; status: string }) {
  return { id: organization.id, name: organization.name, slug: organization.slug, status: organization.status };
}

export async function POST(request: Request) {
  try {
    const authenticatedUser = await requireClerkUser();

    if (!authenticatedUser.email || !authenticatedUser.emailVerified) {
      return NextResponse.json(
        { error: "A verified email address is required to apply." },
        { status: 400 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
    };
    const name = String(body.name || "").trim();
    const slug = slugifyReseller(name);

    if (name.length < 2 || name.length > 100 || !slug) {
      return NextResponse.json(
        { error: "Organization name must be between 2 and 100 characters." },
        { status: 400 },
      );
    }

    const existingMembership = await prisma.resellerOrganizationMember.findFirst({
      where: { userId: authenticatedUser.dbUserId },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    });

    if (existingMembership) {
      return NextResponse.json({ organization: publicOrganization(existingMembership.organization) }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
    }

    const existingSlug = await prisma.resellerOrganization.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existingSlug) {
      return NextResponse.json(
        { error: "That organization name is already taken." },
        { status: 409 },
      );
    }

    const organization = await prisma.$transaction(async (tx) => {
      const created = await tx.resellerOrganization.create({
        data: {
          name,
          slug,
          status: "PENDING",
          tier: "TIER_1",
          members: {
            create: {
              userId: authenticatedUser.dbUserId,
              role: "OWNER",
              active: true,
            },
          },
        },
      });
      return created;
    });

    void sendDiscordResellerApplication({
      organizationName: organization.name,
      organizationSlug: organization.slug,
      applicantEmail: authenticatedUser.email,
      organizationId: organization.id,
    });

    await writeAppLog({
      category: "ADMIN",
      level: "INFO",
      title: "Reseller application submitted",
      message: `${name} submitted a reseller application.`,
      actor: authenticatedUser.email || authenticatedUser.dbUserId,
      route: "/api/reseller/signup",
      metadata: { organizationId: organization.id, slug: organization.slug },
    });

    return NextResponse.json({ organization: publicOrganization(organization) }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "That organization name is already taken." },
        { status: 409 },
      );
    }
    console.error("[reseller/signup POST]", error);
    return NextResponse.json({ error: "Unable to submit reseller application" }, { status: 500 });
  }
}
