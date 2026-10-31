import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateCryptoAvailability,
  normalizeDisabledUntil,
  parseCountryList,
} from "./payment-availability.ts";

const base = {
  enabled: true,
  disabledCountries: ["id"],
  disabledUntil: null as string | null,
};

test("allows crypto when the visitor's country is not on the list", () => {
  const result = evaluateCryptoAvailability(base, "sg");
  assert.deepEqual(result, { allowed: true, reason: null });
});

test("blocks crypto for a listed country", () => {
  const result = evaluateCryptoAvailability(base, "ID");
  assert.deepEqual(result, { allowed: false, reason: "country" });
});

test("blocks crypto globally when disabled", () => {
  const result = evaluateCryptoAvailability(
    { ...base, enabled: false },
    "sg",
  );
  assert.deepEqual(result, { allowed: false, reason: "disabled" });
});

test("ignores the country list once the temporary window has lapsed", () => {
  const result = evaluateCryptoAvailability(
    { ...base, disabledUntil: "2026-11-03T00:00:00.000Z" },
    "id",
    new Date("2026-11-04T00:00:00.000Z"),
  );
  assert.deepEqual(result, { allowed: true, reason: null });
});

test("keeps the block while the window is still open", () => {
  const result = evaluateCryptoAvailability(
    { ...base, disabledUntil: "2026-11-03T00:00:00.000Z" },
    "id",
    new Date("2026-10-31T00:00:00.000Z"),
  );
  assert.deepEqual(result, { allowed: false, reason: "country" });
});

test("treats an empty market code as unrestricted", () => {
  const result = evaluateCryptoAvailability(base, "");
  assert.deepEqual(result, { allowed: true, reason: null });
});

test("parses, lowercases and dedupes country codes", () => {
  assert.deepEqual(parseCountryList(" ID, sg ,id, ,USA"), ["id", "sg"]);
});

test("normalizes an empty or invalid expiry to null", () => {
  assert.equal(normalizeDisabledUntil(""), null);
  assert.equal(normalizeDisabledUntil("not-a-date"), null);
  assert.equal(
    normalizeDisabledUntil("2026-11-03T07:00:00+07:00"),
    "2026-11-03T00:00:00.000Z",
  );
});
