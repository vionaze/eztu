import { createHash } from "node:crypto";
import { parseResellerMarkupPercent, type ResellerPriceMode } from "./reseller-pricing.ts";

export type ResellerWorkbookCell = { value?: unknown; formula?: string };
export type ResellerWorkbookRow = Record<string, ResellerWorkbookCell>;
export type ResellerCatalogIdentity = {
  variantId: string;
  supplierSku: string;
  countryCode: string;
  productSlug: string;
  categorySlug: string;
  name: string;
};
export type ResellerImportRule = {
  variantId: string;
  tier: "TIER_1" | "TIER_2";
  mode: ResellerPriceMode;
  markupMicros: number | null;
  fixedPriceIDR: number | null;
  enabled: boolean;
  provenance: {
    sourceName: string;
    sourceSha256: string;
    sheet: string;
    row: number;
    formula: string;
    supplierSku: string;
    countryCode: string;
    productSlug: string;
  };
};
export type ResellerImportIssue = { sourceName: string; sheet: string; row: number; reason: string };
export type ResellerImportResult = {
  rules: ResellerImportRule[];
  skipped: ResellerImportIssue[];
  blocked: ResellerImportIssue[];
};

const COUNTRY: Record<string, string> = {
  brazil: "br", canada: "ca", germany: "de", indonesia: "id", japan: "jp",
  malaysia: "my", mexico: "mx", philippines: "ph", phillipines: "ph", singapore: "sg",
  thailand: "th", vietnam: "vn", "united kingdom": "gb", "united states": "us", usa: "us",
};
const HEADER_ALIASES: Record<string, string[]> = {
  country: ["country"], categoryCode: ["category code"], productCode: ["product code"],
  productName: ["product name"], customer: ["price customer", "customer price"], reseller: ["reseller price"],
};
const EXPECTED_SLUG: Record<string, string> = {
  ROB: "roblox-gift-card", VPSN: "playstation-store", VSTEAM: "steam", NTD: "nintendo-eshop",
  PCGP: "xbox-pc-game-pass",
};

function text(value: unknown): string { return value == null ? "" : String(value).trim(); }
function normalizedName(value: unknown): string {
  return text(value).normalize("NFKD").replace(/[®™]/g, "").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2010-\u2015]/g, "-").replace(/[^a-zA-Z0-9]+/g, " ").trim().toLowerCase();
}
function countryCode(value: unknown): string { return COUNTRY[normalizedName(value)] ?? normalizedName(value); }
function findColumn(headers: readonly string[], wanted: keyof typeof HEADER_ALIASES): string | undefined {
  const aliases = HEADER_ALIASES[wanted]; return headers.find((header) => aliases.includes(normalizedName(header)));
}
function inferCountry(sourceName: string): string | null {
  const lower = sourceName.toLowerCase();
  for (const [name, code] of Object.entries(COUNTRY)) if (lower.includes(name)) return code;
  return null;
}
function issue(sourceName: string, sheet: string, row: number, reason: string): ResellerImportIssue {
  return { sourceName, sheet, row, reason };
}

/** Validate only the approved final-sheet expression, against the expected same-row source cell. */
function formulaPercent(formula: string, row: number, sourceColumn: string, expected: number, style: "multiply" | "add"): number {
  const f = formula.replace(/\s+/g, "").toUpperCase();
  const cell = `${sourceColumn.toUpperCase()}${row}`;
  let match: RegExpMatchArray | null = null;
  if (style === "multiply") {
    match = f.match(new RegExp(`^\\(?${cell}\\*([0-9]+(?:\\.[0-9]+)?)%\\)?$`)) ??
      f.match(new RegExp(`^\\(?([0-9]+(?:\\.[0-9]+)?)%\\*${cell}\\)?$`));
  }
  else match = f.match(new RegExp(`^\\(?${cell}\\+\\(([0-9]+(?:\\.[0-9]+)?)%\\*${cell}\\)\\)?$`));
  if (!match) throw new Error("FORMULA_RULE_NOT_VERIFIED");
  const multiplier = Number(match[1]);
  const markup = multiplier > 100 ? multiplier - 100 : multiplier;
  if (!Number.isFinite(markup) || Math.abs(markup - expected) > 0.000001) throw new Error("FORMULA_RULE_NOT_VERIFIED");
  return parseResellerMarkupPercent(markup.toFixed(5));
}

export function workbookSourceSha256(source: string | Uint8Array): string {
  return createHash("sha256").update(source).digest("hex");
}

export type ParseResellerWorkbookOptions = {
  sourceName: string;
  sourceSha256?: string;
  sheet: string;
  headers: readonly string[];
  rows: ResellerWorkbookRow[];
  tier?: "TIER_1" | "TIER_2";
  catalog: Map<string, ResellerCatalogIdentity>;
};

export function catalogIdentityKey(country: string, supplierSku: string): string {
  return `${country}\0${supplierSku}`;
}

/** Pure parser for approved workbook final sheets. */
export function parseResellerWorkbook(options: ParseResellerWorkbookOptions): ResellerImportResult {
  const { sourceName, sheet, headers, rows, catalog } = options;
  const result: ResellerImportResult = { rules: [], skipped: [], blocked: [] };
  const countryCol = findColumn(headers, "country");
  const categoryCol = findColumn(headers, "categoryCode");
  const skuCol = findColumn(headers, "productCode");
  const nameCol = findColumn(headers, "productName");
  const customerCol = findColumn(headers, "customer");
  const resellerCol = findColumn(headers, "reseller");
  const isRoblox1 = sheet === "Roblox Tier 1 FINAL";
  const isRoblox2 = sheet === "Roblox Tier 2 FINAL";
  const isPs = sheet === "PAKE INI FINAL RUMUS";
  const isSteam = sheet.includes("STEAM") && sheet.includes("cust");
  const isNintendo = sheet === "NINTENDO B2B";
  const isXbox = sheet.toLowerCase().includes("game pass");
  const supported = isRoblox1 || isRoblox2 || isPs || isSteam || isNintendo || isXbox;
  if (!supported || !skuCol || !nameCol || !categoryCol) {
    for (let i = 0; i < rows.length; i++) result.skipped.push(issue(sourceName, sheet, i + 2, "UNSUPPORTED_SHEET"));
    return result;
  }
  const category = isRoblox1 || isRoblox2 ? "ROB" : isPs ? "VPSN" : isSteam ? "VSTEAM" : isXbox ? "PCGP" : "NTD";
  const expected = isRoblox1 ? 1.11111 : isRoblox2 ? 3.33333 : isPs ? 1.5 : isSteam ? 2 : isXbox ? 3 : 4;
  const style = isSteam || isNintendo ? "add" : "multiply";
  const formulaColumn = isRoblox1 || isRoblox2 ? "K" : isPs ? "F" : "G";
  const sourceColumn = isRoblox1 || isRoblox2 || isPs ? "G" : "H";
  const inferredCountry = countryCol ? null : inferCountry(sourceName);
  if (!countryCol && !inferredCountry) {
    result.blocked.push(issue(sourceName, sheet, 0, "COUNTRY_INFERENCE_REQUIRED")); return result;
  }
  const tiers: Array<"TIER_1" | "TIER_2"> = isRoblox1 ? ["TIER_1"] : isRoblox2 ? ["TIER_2"] : ["TIER_1", "TIER_2"];
  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2; const row = rows[i];
    const sku = text(row[skuCol]?.value); const name = text(row[nameCol]?.value);
    if (!sku && !name) { result.skipped.push(issue(sourceName, sheet, rowNumber, "BLANK_ROW")); continue; }
    if (text(row[categoryCol]?.value) !== category) {
      if (isNintendo && text(row[categoryCol]?.value) === "NTD") result.skipped.push(issue(sourceName, sheet, rowNumber, "UNRESOLVED_NO_VALID_RULE"));
      else result.skipped.push(issue(sourceName, sheet, rowNumber, "CATEGORY_NOT_ALLOWED"));
      continue;
    }
    // Formula must come from the explicitly approved final-rule column. The customer
    // header fallback is only for pure callers that do not provide spreadsheet letters.
    const formulaCell = row[formulaColumn] ?? (customerCol ? row[customerCol] : undefined);
    let formula = formulaCell?.formula ?? "";
    let markupMicros: number;
    if (!formula && isSteam) {
      // The approved Steam business rule covers every VSTEAM SKU. Workbook
      // formula rows are evidence; missing formula rows use this explicit audit marker.
      formula = "APPROVED_BUSINESS_RULE: Steam Wallet supplier cost +2%";
      markupMicros = parseResellerMarkupPercent("2");
    } else if (!formula) {
      result.skipped.push(issue(sourceName, sheet, rowNumber, "UNRESOLVED_NO_VALID_RULE"));
      continue;
    } else {
      try { markupMicros = formulaPercent(formula, rowNumber, sourceColumn, expected, style); }
      catch { result.blocked.push(issue(sourceName, sheet, rowNumber, "FORMULA_RULE_NOT_VERIFIED")); continue; }
    }
    const cc = countryCode(countryCol ? row[countryCol]?.value : inferredCountry);
    const identity = catalog.get(catalogIdentityKey(cc, sku)) ?? catalog.get(`${cc}:${sku}`) ?? catalog.get(`${cc}:${sku}`.toLowerCase());
    if (!identity) { result.blocked.push(issue(sourceName, sheet, rowNumber, "CATALOG_IDENTITY_NOT_FOUND")); continue; }
    if (identity.supplierSku !== sku || identity.countryCode !== cc || identity.productSlug !== EXPECTED_SLUG[category] || normalizedName(identity.name) !== normalizedName(name)) {
      result.blocked.push(issue(sourceName, sheet, rowNumber, "CATALOG_IDENTITY_MISMATCH")); continue;
    }
    for (const tier of tiers) result.rules.push({ variantId: identity.variantId, tier, mode: "MARKUP", markupMicros, fixedPriceIDR: null, enabled: true,
      provenance: { sourceName, sourceSha256: options.sourceSha256 ?? "", sheet, row: rowNumber, formula, supplierSku: sku, countryCode: cc, productSlug: identity.productSlug } });
  }
  const seen = new Set<string>();
  result.rules = result.rules.filter((rule) => { const k = `${rule.tier}:${rule.variantId}`; if (seen.has(k)) { result.blocked.push(issue(sourceName, sheet, rule.provenance.row, "DUPLICATE_AMBIGUITY")); return false; } seen.add(k); return true; });
  return result;
}
