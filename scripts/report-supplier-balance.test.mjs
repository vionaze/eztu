import test from "node:test";
import assert from "node:assert/strict";
import { reportSupplierBalance } from "./report-supplier-balance.mjs";

const env = { SUPPLIER_API_URL: "https://supplier.example", SUPPLIER_SECRET_KEY: "test", DISCORD_FRAUD_WEBHOOK_URL: "https://discord.example/fraud" };

test("sends the verified deposit balance only to the fraud webhook", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return calls.length === 1 ? Response.json({ code: "SUCCESS", data: { balance: 125000 } }) : new Response(null, { status: 204 });
  };
  try {
    assert.deepEqual(await reportSupplierBalance(env), { sent: true });
    assert.equal(calls[0].url, "https://supplier.example/api/balance");
    assert.equal(calls[1].url, env.DISCORD_FRAUD_WEBHOOK_URL);
    const report = JSON.parse(calls[1].options.body);
    assert.match(report.embeds[0].fields[0].value, /125,000/);
    assert.deepEqual(report.allowed_mentions, { parse: [] });
  } finally { globalThis.fetch = originalFetch; }
});

test("does not report missing balance as zero", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests++; return Response.json({ code: "SUCCESS", data: {} }); };
  try {
    await assert.rejects(reportSupplierBalance(env), /invalid balance/);
    assert.equal(requests, 1);
  } finally { globalThis.fetch = originalFetch; }
});
