import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/clerk";
import {
  getPakasirPaymentSettings,
  setSetting,
  SETTING_KEYS,
} from "@/lib/settings";
import { writeAppLog } from "@/lib/app-log";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminUser();
    return NextResponse.json({ settings: await getPakasirPaymentSettings() });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await requireAdminUser();
    const body = (await request.json()) as { pakasirEnabled?: unknown };
    if (typeof body.pakasirEnabled !== "boolean") {
      return NextResponse.json(
        { error: "pakasirEnabled must be a boolean." },
        { status: 400 }
      );
    }
    await setSetting(
      SETTING_KEYS.PAKASIR_ENABLED,
      body.pakasirEnabled ? "true" : "false"
    );
    const settings = await getPakasirPaymentSettings();
    await writeAppLog({
      category: "ADMIN",
      level: "INFO",
      title: `Pakasir checkout ${settings.adminEnabled ? "enabled" : "disabled"}`,
      actor: admin.email || admin.dbUserId,
      route: "/api/admin/settings/payments",
      metadata: {
        adminEnabled: settings.adminEnabled,
        environmentEnabled: settings.environmentEnabled,
        configured: settings.configured,
        effectiveEnabled: settings.effectiveEnabled,
      },
    });
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("[admin/settings/payments]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Save failed" },
      { status: 500 }
    );
  }
}
