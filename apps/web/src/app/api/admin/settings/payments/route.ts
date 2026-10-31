import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/clerk";
import { setSetting } from "@/lib/settings";
import {
  getCryptoCheckoutSettings,
  getPakasirAdminEnabled,
  getResellerCryptoAdminEnabled,
  getResellerPakasirAdminEnabled,
  PAYMENT_SETTING_KEYS,
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
    const [crypto, pakasirEnabled, resellerCryptoEnabled, resellerPakasirEnabled] =
      await Promise.all([
        getCryptoCheckoutSettings(),
        getPakasirAdminEnabled(),
        getResellerCryptoAdminEnabled(),
        getResellerPakasirAdminEnabled(),
      ]);
    return NextResponse.json(
      {
        settings: {
          ...crypto,
          pakasirEnabled,
          resellerCryptoEnabled,
          resellerPakasirEnabled,
        },
      },
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
      pakasirEnabled?: unknown;
      resellerCryptoEnabled?: unknown;
      resellerPakasirEnabled?: unknown;
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

    const pakasirEnabled =
      typeof body.pakasirEnabled === "boolean"
        ? body.pakasirEnabled
        : await getPakasirAdminEnabled();

    if (typeof body.pakasirEnabled === "boolean") {
      await setSetting(
        PAYMENT_SETTING_KEYS.PAKASIR_ENABLED,
        pakasirEnabled ? "true" : "false",
      );
    }

    const resellerCryptoEnabled =
      typeof body.resellerCryptoEnabled === "boolean"
        ? body.resellerCryptoEnabled
        : await getResellerCryptoAdminEnabled();

    if (typeof body.resellerCryptoEnabled === "boolean") {
      await setSetting(
        PAYMENT_SETTING_KEYS.RESELLER_CRYPTO_ENABLED,
        resellerCryptoEnabled ? "true" : "false",
      );
    }

    const resellerPakasirEnabled =
      typeof body.resellerPakasirEnabled === "boolean"
        ? body.resellerPakasirEnabled
        : await getResellerPakasirAdminEnabled();

    if (typeof body.resellerPakasirEnabled === "boolean") {
      await setSetting(
        PAYMENT_SETTING_KEYS.RESELLER_PAKASIR_ENABLED,
        resellerPakasirEnabled ? "true" : "false",
      );
    }

    return NextResponse.json({
      settings: {
        ...settings,
        pakasirEnabled,
        resellerCryptoEnabled,
        resellerPakasirEnabled,
      },
    });
  } catch (error) {
    console.error("[Admin payment settings] save failed", error);
    return NextResponse.json(
      { error: "Unable to save payment settings" },
      { status: 400 },
    );
  }
}
