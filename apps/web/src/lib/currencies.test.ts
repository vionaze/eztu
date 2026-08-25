import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_COUNTRY,
  findCountryByRegion,
  resolveCountryByRegion,
} from "./currencies.ts";

test("uses Global USD as the safe storefront default", () => {
  assert.equal(DEFAULT_COUNTRY.code, "GLOBAL");
  assert.equal(DEFAULT_COUNTRY.supplierCode, "global");
  assert.equal(DEFAULT_COUNTRY.currency, "USD");
});

test("keeps registered visitors in their exact market", () => {
  const country = resolveCountryByRegion("ID");

  assert.equal(country.code, "ID");
  assert.equal(country.supplierCode, "id");
  assert.equal(country.currency, "IDR");
});

test("maps visitors outside registered markets to Global USD", () => {
  assert.equal(findCountryByRegion("AU"), null);

  const country = resolveCountryByRegion("AU");
  assert.equal(country.code, "GLOBAL");
  assert.equal(country.currency, "USD");
});
