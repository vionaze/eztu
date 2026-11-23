import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/clerk";
import { setSetting } from "@/lib/settings";
import {
  getCryptoCheckoutSettings,
  getResellerCryptoAdminEnabled,
  getResellerWinpayAdminEnabled,
  getWinpayAdminEnabled,
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
    const [
      crypto,
      winpayEnabled,
      resellerCryptoEnabled,
      resellerWinpayEnabled,
    ] = await Promise.all([
      getCryptoCheckoutSettings(),
      getWinpayAdminEnabled(),
      getResellerCryptoAdminEnabled(),
      getResellerWinpayAdminEnabled(),
    ]);
    return NextResponse.json(
      {
        settings: {
          ...crypto,
          winpayEnabled,
          resellerCryptoEnabled,
          resellerWinpayEnabled,
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
      winpayEnabled?: unknown;
      resellerCryptoEnabled?: unknown;
      resellerWinpayEnabled?: unknown;
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

    const winpayEnabled =
      typeof body.winpayEnabled === "boolean"
        ? body.winpayEnabled
        : await getWinpayAdminEnabled();

    if (typeof body.winpayEnabled === "boolean") {
      await setSetting(
        PAYMENT_SETTING_KEYS.WINPAY_ENABLED,
        winpayEnabled ? "true" : "false",
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

    const resellerWinpayEnabled =
      typeof body.resellerWinpayEnabled === "boolean"
        ? body.resellerWinpayEnabled
        : await getResellerWinpayAdminEnabled();

    if (typeof body.resellerWinpayEnabled === "boolean") {
      await setSetting(
        PAYMENT_SETTING_KEYS.RESELLER_WINPAY_ENABLED,
        resellerWinpayEnabled ? "true" : "false",
      );
    }

    return NextResponse.json({
      settings: {
        ...settings,
        winpayEnabled,
        resellerCryptoEnabled,
        resellerWinpayEnabled,
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
