import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@kupon/db";
import { requireAdminUser } from "@/lib/clerk";
import {
  getPricingMarkupSettings,
  PricingMarkupError,
  savePricingMarkupSettings,
} from "@/lib/pricing-markup";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [settings, products] = await Promise.all([
      getPricingMarkupSettings(true),
      prisma.product.findMany({
        select: { slug: true, name: true, published: true },
        orderBy: { name: "asc" },
      }),
    ]);
    return NextResponse.json(
      { settings, products },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[Admin pricing settings] read failed", error);
    return NextResponse.json(
      { error: "Unable to read pricing settings" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdminUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      globalPercent?: unknown;
      overrides?: unknown;
    };
    if (typeof body.globalPercent !== "string") {
      return NextResponse.json(
        { error: "Global percentage is required." },
        { status: 400 },
      );
    }
    const overrides: Record<string, string> = {};
    if (body.overrides && typeof body.overrides === "object") {
      for (const [slug, value] of Object.entries(
        body.overrides as Record<string, unknown>,
      )) {
        if (typeof value === "string") overrides[slug] = value;
        else if (typeof value === "number") overrides[slug] = String(value);
      }
    }

    const result = await savePricingMarkupSettings({
      globalPercent: body.globalPercent,
      overrides,
    });
    revalidatePath("/");
    revalidatePath("/vouchers");
    revalidatePath("/products", "layout");
    return NextResponse.json({
      settings: result.settings,
      updatedVariants: result.updated,
    });
  } catch (error) {
    if (error instanceof PricingMarkupError) {
      return NextResponse.json(
        { error: error.message, field: error.field },
        { status: 400 },
      );
    }
    console.error("[Admin pricing settings] save failed", error);
    return NextResponse.json(
      { error: "Unable to save pricing settings" },
      { status: 500 },
    );
  }
}
