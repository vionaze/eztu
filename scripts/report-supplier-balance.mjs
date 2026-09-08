import { pathToFileURL } from "node:url";

export async function reportSupplierBalance(env = process.env) {
  const token = (env.SUPPLIER_SECRET_KEY || env.SUPPLIER_API_KEY || "").trim();
  const webhook = env.DISCORD_FRAUD_WEBHOOK_URL?.trim();
  const currency = env.SUPPLIER_BALANCE_CURRENCY?.trim().toUpperCase() || "IDR";
  if (!token || !webhook || !env.SUPPLIER_API_URL) throw new Error("Missing supplier or fraud webhook configuration");
  const url = new URL("/api/balance", env.SUPPLIER_API_URL);
  const destination = new URL(webhook);
  if (url.protocol !== "https:" || destination.protocol !== "https:") throw new Error("HTTPS required");
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Invalid settlement currency");
  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20000),
    });
  } catch { throw new Error("Supplier balance connection failed"); }
  if (!response.ok) throw new Error(`Supplier balance HTTP ${response.status}`);
  const body = await response.json();
  const raw = body?.data?.balance;
  const balance = typeof raw === "number" || (typeof raw === "string" && raw.trim()) ? Number(raw) : NaN;
  if (body?.code !== "SUCCESS" || !Number.isFinite(balance) || balance < 0) {
    throw new Error("Supplier returned an invalid balance; no report sent");
  }
  const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency }).format(balance);
  let delivered;
  try {
    delivered = await fetch(destination, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        allowed_mentions: { parse: [] },
        embeds: [{ title: "EZTopup — Supplier deposit balance", color: 0x34d399,
          fields: [{ name: `Available balance (${currency})`, value: formatted }],
          footer: { text: "Scheduled report · every 6 hours" }, timestamp: new Date().toISOString() }],
      }),
      signal: AbortSignal.timeout(20000),
    });
  } catch { throw new Error("Discord balance report connection failed"); }
  if (!delivered.ok) throw new Error(`Discord balance report HTTP ${delivered.status}`);
  return { sent: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  reportSupplierBalance().then(() => console.log(`${new Date().toISOString()} Supplier balance report sent to fraud webhook`)).catch(error => {
    // Never print request objects, URLs, or credentials.
    console.error(`${new Date().toISOString()} Balance report failed: ${error instanceof Error && !/https?:/.test(error.message) ? error.message : "Invalid configuration or response"}`);
    process.exitCode = 1;
  });
}
