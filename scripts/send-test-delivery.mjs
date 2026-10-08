#!/usr/bin/env node
/**
 * Dummy delivery test: builds the standard order-details Excel with fake vouchers
 * and emails it to the given address, exactly like a completed B2B order.
 *
 * Usage (VPS):
 *   node scripts/send-test-delivery.mjs [email]
 */
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";

const requireFromDb = createRequire(new URL("../packages/db/package.json", import.meta.url));
const XLSX = requireFromDb("xlsx");

const envPaths = ["apps/web/.env", "../apps/web/.env"];
let env = {};
for (const path of envPaths) {
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[match[1]] = value;
  }
  break;
}

const apiKey = (process.env.RESEND_API_KEY || env.RESEND_API_KEY || "").trim();
const from = (process.env.EMAIL_FROM || env.EMAIL_FROM || "EZTopUp <sales@eztopup.io>").trim();
const replyTo = (process.env.EMAIL_REPLY_TO || env.EMAIL_REPLY_TO || "sales@eztopup.io").trim();
const to = (process.argv[2] || "aigaktidur@gmail.com").trim();

if (!apiKey) {
  console.error("RESEND_API_KEY tidak ditemukan di environment atau apps/web/.env");
  process.exit(1);
}

const columns = ["Product Name", "Reference Number", "Transaction ID", "Delivery Name", "Delivery To", "Voucher", "Voucher Pin", "Account Data", "Note", "Status", "Reason (If Failed)"];
const rows = [
  ["E-Voucher PlayStation ® Store Rp 100.000", "example", "Terminal GIDTEST00000000000001", null, "*", "DUMMY-PS10-4F7K", "-", "-", "DUMMY", "Success", null],
  ["E-Voucher PlayStation ® Store Rp 100.000", "example", "Terminal GIDTEST00000000000001", null, "*", "DUMMY-PS10-9Q2M", "-", "-", "DUMMY", "Success", null],
  ["PC Game Pass 3 Months Subscription", "example", "Terminal GIDTEST00000000000002", null, "*", "DUMMY-PCGP-7X3B", "-", "-", "DUMMY", "Success", null],
  ["Nintendo $10", "example", "Terminal GIDTEST00000000000003", null, "*", "DUMMY-NTD10-2W8L", "-", "-", "DUMMY", "Success", null],
];

const sheet = XLSX.utils.aoa_to_sheet([columns, ...rows]);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, sheet, "data");
const attachment = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
const orderNumber = `DUMMY-${Date.now().toString(36).toUpperCase()}`;
const filename = `order_details_${orderNumber}.xlsx`;

const response = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    from,
    to,
    reply_to: replyTo,
    subject: `EZTopUp wholesale order ${orderNumber} — vouchers attached (DUMMY)`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h1 style="font-size:22px;margin:0 0 16px">Your vouchers are ready (DUMMY TEST)</h1>
      <p>Order <strong>${orderNumber}</strong> is a dummy test. 4 voucher code(s) are attached as
      <strong>${filename}</strong> in the standard order-details format.</p>
      <p>Thank you,<br />EZTopUp Team</p>
    </div>`,
    text: `DUMMY TEST — order ${orderNumber}. 4 voucher codes attached as ${filename}.`,
    attachments: [{ filename, content: attachment }],
  }),
});

if (!response.ok) {
  console.error("Gagal kirim:", response.status, await response.text().catch(() => ""));
  process.exit(1);
}
console.log(JSON.stringify({ sent: true, to, from, filename, rows: rows.length }, null, 2));
