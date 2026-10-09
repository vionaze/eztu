import assert from "node:assert/strict";
import test from "node:test";
import XlsxPopulate from "xlsx-populate";
import * as XLSX from "xlsx";
import { buildEncryptedOrderDetailsWorkbook, DELIVERY_SHEET_COLUMNS } from "./b2b-delivery-export.ts";

const order = {
  reference: "test-reseller", orderNumber: "B2B-TEST",
  lines: [{ productName: "Test gift card", quantity: 1, supplierTid: "TEST-TID", codes: ["TEST-VOUCHER-ONLY"] }],
};

test("encrypted delivery opens with its password and preserves voucher rows", async () => {
  const { encryptedFile, password } = await buildEncryptedOrderDetailsWorkbook(order);
  assert.equal(password.length, 32);
  assert.equal(encryptedFile.subarray(0, 8).toString("hex"), "d0cf11e0a1b11ae1");
  assert.equal(encryptedFile.includes(Buffer.from("TEST-VOUCHER-ONLY")), false);
  const unlocked = await XlsxPopulate.fromDataAsync(encryptedFile, { password });
  const workbook = XLSX.read(await unlocked.outputAsync({ type: "nodebuffer" }), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets.data, { header: 1 });
  assert.deepEqual(rows[0], [...DELIVERY_SHEET_COLUMNS]);
  assert.equal(rows[1][5], "TEST-VOUCHER-ONLY");
  assert.equal(rows[1][2], "TEST-TID");
});

test("encrypted delivery rejects missing and incorrect passwords", async () => {
  const { encryptedFile } = await buildEncryptedOrderDetailsWorkbook(order);
  await assert.rejects(XlsxPopulate.fromDataAsync(encryptedFile));
  await assert.rejects(XlsxPopulate.fromDataAsync(encryptedFile, { password: "incorrect-password" }));
});
