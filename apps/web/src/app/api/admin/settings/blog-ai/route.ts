import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/clerk";
import {
  getBlogAiSettings,
  setSetting,
  SETTING_KEYS,
} from "@/lib/settings";
import { writeAppLog } from "@/lib/app-log";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminUser();
    const settings = await getBlogAiSettings();
    // Never expose full API key — mask middle
    const key = settings.apiKey;
    const masked =
      key.length > 8
        ? `${key.slice(0, 4)}${"•".repeat(Math.min(key.length - 8, 12))}${key.slice(-4)}`
        : key
          ? "••••••••"
          : "";

    return NextResponse.json({
      settings: {
        enabled: settings.enabled,
        baseUrl: settings.baseUrl,
        apiKey: masked,
        hasApiKey: Boolean(key),
        model: settings.model,
        countries: settings.countries,
        autoCountries: settings.autoCountries,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await requireAdminUser();
    const body = (await request.json()) as {
      enabled?: boolean;
      baseUrl?: string;
      apiKey?: string;
      model?: string;
      countries?: string[] | string;
      autoCountries?: string[] | string;
    };

    if (body.enabled !== undefined) {
      await setSetting(
        SETTING_KEYS.AI_ENABLED,
        body.enabled ? "true" : "false"
      );
    }
    if (body.baseUrl !== undefined) {
      await setSetting(
        SETTING_KEYS.AI_BASE_URL,
        String(body.baseUrl).replace(/\/$/, "").trim()
      );
    }
    // Only update key if a non-masked value is provided
    if (body.apiKey !== undefined) {
      const raw = String(body.apiKey).trim();
      if (raw && !raw.includes("•")) {
        await setSetting(SETTING_KEYS.AI_API_KEY, raw);
      }
    }
    if (body.model !== undefined) {
      await setSetting(SETTING_KEYS.AI_MODEL, String(body.model).trim());
    }
    if (body.countries !== undefined) {
      const list = Array.isArray(body.countries)
        ? body.countries
        : String(body.countries).split(",");
      await setSetting(
        SETTING_KEYS.AI_COUNTRIES,
        list
          .map((c) => String(c).trim().toUpperCase())
          .filter(Boolean)
          .join(",")
      );
    }
    if (body.autoCountries !== undefined) {
      const list = Array.isArray(body.autoCountries)
        ? body.autoCountries
        : String(body.autoCountries).split(",");
      await setSetting(
        SETTING_KEYS.AI_AUTO_COUNTRIES,
        list
          .map((c) => String(c).trim().toUpperCase())
          .filter(Boolean)
          .join(",")
      );
    }

    const settings = await getBlogAiSettings();

    await writeAppLog({
      category: "ADMIN",
      level: "INFO",
      title: "Blog AI settings updated",
      actor: admin.email || admin.dbUserId,
      route: "/api/admin/settings/blog-ai",
      metadata: {
        enabled: settings.enabled,
        model: settings.model,
        autoCountries: settings.autoCountries,
      },
    });

    const key = settings.apiKey;
    const masked =
      key.length > 8
        ? `${key.slice(0, 4)}${"•".repeat(Math.min(key.length - 8, 12))}${key.slice(-4)}`
        : key
          ? "••••••••"
          : "";

    return NextResponse.json({
      settings: {
        enabled: settings.enabled,
        baseUrl: settings.baseUrl,
        apiKey: masked,
        hasApiKey: Boolean(key),
        model: settings.model,
        countries: settings.countries,
        autoCountries: settings.autoCountries,
      },
    });
  } catch (error) {
    console.error("[admin/settings/blog-ai]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Save failed" },
      { status: 500 }
    );
  }
}
