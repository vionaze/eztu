#!/usr/bin/env node
/**
 * WinPay end-to-end status check (read-only).
 *
 * Verifies, in one run:
 *   1. local env completeness (values masked)
 *   2. what the deployed app reports for /api/payment/methods
 *   3. whether the deployed callback route exists and rejects safely
 *   4. whether WinPay hosts answer JSON (edge block vs API rejection)
 *
 * It never creates an invoice, never charges anyone, and never prints a secret.
 * Use `pnpm winpay:preflight` when you want to actually create one invoice.
 *
 * Usage: pnpm winpay:status
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TIMEOUT_MS = 15_000;

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(root, "apps/web/.env"));
loadEnvFile(resolve(root, "apps/web/.env.local"));

const results = [];
function record(name, status, detail) {
  results.push({ name, status, detail });
  const icon = status === "PASS" ? "✓" : status === "WARN" ? "!" : "✗";
  console.log(`${icon} ${status.padEnd(4)} ${name}${detail ? ` — ${detail}` : ""}`);
}

function mask(value) {
  if (!value) return "belum di-set";
  return `terisi (${value.length} char)`;
}

// 1. Local env
const enabled = (process.env.WINPAY_ENABLED || "").trim().toLowerCase();
record(
  "WINPAY_ENABLED",
  enabled === "true" ? "PASS" : "WARN",
  enabled === "true" ? "true" : `"${process.env.WINPAY_ENABLED ?? ""}" (checkout IDR tidak akan muncul)`,
);
record("WINPAY_KEY", process.env.WINPAY_KEY?.trim() ? "PASS" : "FAIL", mask(process.env.WINPAY_KEY?.trim()));
record(
  "WINPAY_SECRET_KEY",
  process.env.WINPAY_SECRET_KEY?.trim() ? "PASS" : "FAIL",
  mask(process.env.WINPAY_SECRET_KEY?.trim()),
);
const baseUrlRaw = (process.env.WINPAY_BASE_URL || "").trim();
record(
  "WINPAY_BASE_URL",
  "PASS",
  baseUrlRaw || "kosong (produksi: https://checkout.winpay.id)",
);

// 2. Deployed app surface
// Prefer an explicit target, ignore a localhost dev URL, fall back to production.
const explicitUrl = (process.argv[2] || process.env.WINPAY_STATUS_APP_URL || "").trim();
const envUrl = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
const localDevUrl = /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(envUrl);
const appUrl = (explicitUrl || (envUrl && !localDevUrl ? envUrl : "https://eztopup.io")).replace(/\/$/, "");
console.log(`\nTarget aplikasi: ${appUrl}`);


async function getJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, json, text };
}

try {
  const methods = await getJson(`${appUrl}/api/payment/methods`);
  if (methods.status !== 200 || !methods.json) {
    record("GET /api/payment/methods", "FAIL", `HTTP ${methods.status}`);
  } else if (!("winpay" in methods.json)) {
    record(
      "GET /api/payment/methods",
      "FAIL",
      "tidak ada key winpay → build lama / belum deploy",
    );
  } else {
    const retail = methods.json.winpay?.enabled;
    const reseller = methods.json.reseller?.winpay?.enabled;
    record(
      "GET /api/payment/methods",
      retail ? "PASS" : "WARN",
      `retail winpay=${retail}, reseller winpay=${reseller}, pakasir=${methods.json.pakasir?.enabled}`,
    );
  }
} catch (error) {
  record("GET /api/payment/methods", "FAIL", `${appUrl} — ${error instanceof Error ? error.message : String(error)}`);
}

try {
  const response = await fetch(`${appUrl}/api/payment/winpay/callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  // 409 = route hidup dan menolak payload tanpa referensi (tanpa security alert).
  record(
    "POST /api/payment/winpay/callback",
    response.status === 409 ? "PASS" : "FAIL",
    response.status === 409 ? "409 sesuai harapan (route hidup)" : `HTTP ${response.status} (404 = belum deploy)`,
  );
} catch (error) {
  record(
    "POST /api/payment/winpay/callback",
    "FAIL",
    error instanceof Error ? error.message : String(error),
  );
}

// 3. WinPay reachability from this machine
async function probeHost(name, url) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "EZTopUp/1.0 (+https://eztopup.io)",
      },
      body: "{}",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await response.text();
    const isJson = body.trimStart().startsWith("{");
    const cfRay = response.headers.get("cf-ray");
    const blocked = !isJson || response.headers.get("cf-mitigated") !== null;
    record(
      `${name} reachable`,
      blocked ? "FAIL" : "PASS",
      `HTTP ${response.status}${isJson ? " JSON" : " non-JSON (edge block)"}${cfRay ? ` cf-ray ${cfRay}` : ""}` +
        (isJson ? ` ${body.replace(/\s+/g, " ").slice(0, 90)}` : ""),
    );
  } catch (error) {
    record(`${name} reachable`, "FAIL", error instanceof Error ? error.message : String(error));
  }
}

await probeHost("checkout API (checkout.winpay.id)", "https://checkout.winpay.id/api/create");
await probeHost("SNAP API (snap.winpay.id)", "https://snap.winpay.id/v1.0/transfer-va/create-va");

// Summary
const counts = results.reduce(
  (acc, item) => ({ ...acc, [item.status]: (acc[item.status] || 0) + 1 }),
  {},
);
console.log(
  `\nRingkasan: ${counts.PASS || 0} PASS, ${counts.WARN || 0} WARN, ${counts.FAIL || 0} FAIL`,
);
if (counts.FAIL) {
  console.log(
    "Ada FAIL. Untuk kegagalan yang menyebut edge block / non-JSON, kirim barisnya ke WinPay\n" +
      "beserta cf-ray dan IP egress server (curl -4 -s https://ifconfig.me).\n" +
      "Untuk key winpay yang hilang di /api/payment/methods, deploy dulu (bash scripts/deploy-vps.sh).",
  );
}
process.exit(counts.FAIL ? 1 : 0);
