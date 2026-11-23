import assert from "node:assert/strict";
import test from "node:test";
import { parseMarkupPercent } from "./pricing-markup-parse.ts";

test("accepts percentages and converts to basis points", () => {
  assert.deepEqual(parseMarkupPercent("0.7"), { ok: true, bps: 70 });
  assert.deepEqual(parseMarkupPercent("4,15"), { ok: true, bps: 415 });
  assert.deepEqual(parseMarkupPercent("0"), { ok: true, bps: 0 });
  assert.deepEqual(parseMarkupPercent("12"), { ok: true, bps: 1200 });
});

test("rejects negative and out-of-range percentages", () => {
  for (const raw of ["-0.7", "-5", "1000.01", "abc", "1.234", ""]) {
    const parsed = parseMarkupPercent(raw);
    assert.equal(parsed.ok, false, raw);
  }
  assert.match(
    (parseMarkupPercent("-1") as { ok: false; error: string }).error,
    /negatif/,
  );
});
