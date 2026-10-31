import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/clerk";
import {
  getCryptoCheckoutSettings,
  saveCryptoCheckoutSettings,
} from "@/lib/payment-settings";
import {
  normalizeDisabledUntil,
  parseCountryList,
} from "@/lib/payment-availability";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(
      { settings: await getCryptoCheckoutSettings() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[Admin payment settings] read failed", error);
    return NextResponse.json(
      { error: "Unable to read payment settings" },
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
      enabled?: unknown;
      disabledCountries?: unknown;
      disabledUntil?: unknown;
    };
    const current = await getCryptoCheckoutSettings();

    const enabled =
      typeof body.enabled === "boolean" ? body.enabled : current.enabled;
    const disabledCountries =
      typeof body.disabledCountries === "string"
        ? parseCountryList(body.disabledCountries).join(",")
        : current.disabledCountries.join(",");
    const disabledUntil =
      typeof body.disabledUntil === "string"
        ? normalizeDisabledUntil(body.disabledUntil)
        : current.disabledUntil;

    const settings = await saveCryptoCheckoutSettings({
      enabled,
      disabledCountries,
      disabledUntil: disabledUntil ?? "",
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("[Admin payment settings] save failed", error);
    return NextResponse.json(
      { error: "Unable to save payment settings" },
      { status: 400 },
    );
  }
}
