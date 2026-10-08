import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import xlsx from "xlsx";
import { catalogIdentityKey, parseResellerWorkbook, type ResellerCatalogIdentity, type ResellerImportRule } from "./reseller-price-import.ts";

const packageRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");
const repoRoot = resolve(packageRoot, "../..");
const schemaPath = resolve(packageRoot, "prisma/schema.prisma");
const defaults: Record<string, string> = {
  "roblox update (1).xlsx": "Roblox Tier 1 FINAL",
  "playstation store B2B Indonesia.xlsx": "PAKE INI FINAL RUMUS",
  "steam B2B.xlsx": "STEAM COGS EZ b2b cust (2)",
  "NINTENDO E SHOP US B2B.xlsx": "NINTENDO B2B",
  "PC GAME PASS XBOX.xlsx": "pc game pass 3 bulan b2b rate",
};

type SnapshotRow = {
  id: string; name: string; countryCode: string; supplierSku: string | null; published?: boolean;
  replacementForId?: string | null; product: { slug: string; name?: string; categorySlug?: string; globalAvailability?: boolean };
};
type RuleReport = { schemaHash: string; generatedAt: string; sourceDir?: string; rules: ResellerImportRule[]; skipped: unknown[]; skippedCounts?: Record<string, number>; blocked: unknown[] };
function arg(name: string): string | undefined { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; }
function sha(value: string | Buffer): string { return createHash("sha256").update(value).digest("hex"); }
function schemaHash(): string { return sha(readFileSync(schemaPath)); }

function loadEnvFile(path: string): void {
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key || key in process.env) continue;
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!value || value.startsWith("encrypted:")) continue;
    process.env[key] = value;
  }
}

/** Match Prisma's env resolution so the CLI works on VPS without exported shell vars. */
function ensureDatabaseEnv(): void {
  if (process.env.DATABASE_URL) return;
  for (const candidate of [resolve(packageRoot, ".env"), resolve(repoRoot, ".env"), resolve(repoRoot, "apps/web/.env")]) {
    if (!existsSync(candidate)) continue;
    loadEnvFile(candidate);
    if (process.env.DATABASE_URL) return;
  }
  throw new Error("DATABASE_URL_NOT_FOUND: set it in the shell or in packages/db/.env, repo .env, or apps/web/.env");
}
function rowMap(headers: string[], values: unknown[], formulas: Record<string, string>) {
  const entries: Array<[string, { value?: unknown; formula?: string }]> = [];
  headers.forEach((header, i) => {
    const cell = { value: values[i], formula: formulas[header] };
    entries.push([header, cell]);
    entries.push([xlsx.utils.encode_col(i), cell]);
  });
  return Object.fromEntries(entries);
}
function snapshotRows(raw: unknown): SnapshotRow[] {
  if (Array.isArray(raw)) return raw as SnapshotRow[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { rows?: unknown }).rows)) return (raw as { rows: SnapshotRow[] }).rows;
  if (raw && typeof raw === "object" && Array.isArray((raw as { variants?: unknown }).variants)) return (raw as { variants: SnapshotRow[] }).variants;
  throw new Error("INVALID_SNAPSHOT_SHAPE");
}
function addCatalog(map: Map<string, ResellerCatalogIdentity>, row: SnapshotRow, requirePublished: boolean): void {
  if (!row.supplierSku || row.replacementForId || (requirePublished && row.published === false)) return;
  const value: ResellerCatalogIdentity = {
    variantId: row.id, supplierSku: row.supplierSku, countryCode: row.countryCode,
    productSlug: row.product.slug, categorySlug: row.product.categorySlug ?? "game-vouchers", name: row.name,
  };
  const key = catalogIdentityKey(value.countryCode, value.supplierSku);
  if (map.has(key)) throw new Error(`DUPLICATE_CATALOG_IDENTITY:${value.countryCode}:${value.supplierSku}`);
  map.set(key, value);
}
function readWorkbookRules(sourceDir: string, catalog: Map<string, ResellerCatalogIdentity>) {
  const rules: ResellerImportRule[] = []; const skipped: unknown[] = []; const blocked: unknown[] = [];
  for (const [filename, preferredSheet] of Object.entries(defaults)) {
    const path = resolve(sourceDir, filename);
    if (!existsSync(path)) { blocked.push({ sourceName: filename, sheet: "", row: 0, reason: "SOURCE_NOT_FOUND" }); continue; }
    const buffer = readFileSync(path); const workbook = xlsx.read(buffer, { type: "buffer", cellFormula: true });
    const parseSheet = (sheetName: string, tier?: "TIER_1" | "TIER_2") => {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        blocked.push({ sourceName: filename, sheet: sheetName, row: 0, reason: "REQUIRED_SHEET_NOT_FOUND" });
        return;
      }
      const matrix = xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true });
      const headers = (matrix[0] ?? []).map(String);
      const rows = (matrix.slice(1) as unknown[][]).map((values, index) => {
        const formulas: Record<string, string> = {};
        headers.forEach((header, col) => { const cell = sheet[xlsx.utils.encode_cell({ r: index + 1, c: col })]; if (cell?.f) formulas[header] = cell.f; });
        return rowMap(headers, values, formulas);
      });
      const result = parseResellerWorkbook({ sourceName: filename, sourceSha256: sha(buffer), sheet: sheetName, headers, rows, tier, catalog });
      for (const rule of result.rules) rules.push(rule);
      for (const item of result.skipped) skipped.push(item);
      for (const item of result.blocked) blocked.push(item);
    };
    parseSheet(preferredSheet);
    if (filename.startsWith("roblox")) parseSheet("Roblox Tier 2 FINAL", "TIER_2");
  }
  const seen = new Map<string, ResellerImportRule>();
  const deduped: ResellerImportRule[] = [];
  for (const rule of rules) {
    const key = `${rule.tier}:${rule.variantId}`;
    const previous = seen.get(key);
    if (previous) {
      blocked.push({ sourceName: rule.provenance.sourceName, sheet: rule.provenance.sheet, row: rule.provenance.row, reason: "DUPLICATE_AMBIGUITY" });
      continue;
    }
    seen.set(key, rule); deduped.push(rule);
  }
  return { rules: deduped, skipped, blocked };
}
function assertOutputOutsideRepo(output: string): string {
  const resolved = resolve(output); const rel = relative(repoRoot, resolved);
  if (rel === "" || (!rel.startsWith("../") && rel !== "..")) throw new Error("OUTPUT_MUST_BE_OUTSIDE_REPOSITORY");
  return resolved;
}
async function loadCatalog(snapshotPath?: string): Promise<Map<string, ResellerCatalogIdentity>> {
  const map = new Map<string, ResellerCatalogIdentity>();
  if (snapshotPath) { for (const row of snapshotRows(JSON.parse(readFileSync(snapshotPath, "utf8")))) addCatalog(map, row, false); return map; }
  ensureDatabaseEnv();
  const { prisma } = await import("./index.ts");
  try {
    const variants = await prisma.productVariant.findMany({ where: { published: true, replacementForId: null }, select: { id: true, name: true, supplierSku: true, countryCode: true, published: true, replacementForId: true, product: { select: { slug: true, name: true, category: { select: { slug: true } } } } } });
    for (const row of variants) addCatalog(map, { ...row, product: { ...row.product, categorySlug: row.product.category?.slug }, published: row.published }, true);
    return map;
  } finally { await prisma.$disconnect(); }
}
function readRulesFile(path: string): RuleReport {
  const report = JSON.parse(readFileSync(path, "utf8")) as RuleReport;
  if (report.schemaHash !== schemaHash() || !Array.isArray(report.rules) ||
      !Array.isArray(report.blocked) || !Array.isArray(report.skipped)) {
    throw new Error("INVALID_RULES_FILE_SCHEMA");
  }
  const seen = new Set<string>();
  for (const rule of report.rules) {
    const markupMicros = rule?.markupMicros;
    if (!rule || (rule.tier !== "TIER_1" && rule.tier !== "TIER_2") || rule.mode !== "MARKUP" ||
        typeof rule.variantId !== "string" ||
        typeof markupMicros !== "number" || !Number.isSafeInteger(markupMicros) || markupMicros < 0 || markupMicros > 100_000_000 ||
        rule.fixedPriceIDR !== null || rule.enabled !== true || !rule.provenance ||
        typeof rule.provenance.sourceName !== "string" || typeof rule.provenance.sourceSha256 !== "string" || !/^[a-f0-9]{64}$/.test(rule.provenance.sourceSha256) ||
        typeof rule.provenance.sheet !== "string" || !Number.isSafeInteger(rule.provenance.row) || rule.provenance.row < 2 ||
        typeof rule.provenance.formula !== "string" || typeof rule.provenance.supplierSku !== "string" ||
        typeof rule.provenance.countryCode !== "string" || typeof rule.provenance.productSlug !== "string") {
      throw new Error("INVALID_RULES_FILE_SCHEMA");
    }
    const key = `${rule.tier}:${rule.variantId}`;
    if (seen.has(key)) throw new Error("DUPLICATE_RULE_IDENTITY");
    seen.add(key);
  }
  return report;
}
async function applyRules(report: RuleReport): Promise<void> {
  if (report.blocked.length) throw new Error(`BLOCKED_IMPORT:${report.blocked.length}`);
  if (!report.rules.length) throw new Error("EMPTY_RULES_IMPORT");
  ensureDatabaseEnv();
  const { prisma } = await import("./index.ts");
  try {
    await prisma.$transaction(async (tx) => {
      const ids = [...new Set(report.rules.map((rule) => rule.variantId))];
      const variants = await tx.productVariant.findMany({ where: { id: { in: ids }, published: true, replacementForId: null, product: { published: true } }, select: { id: true, supplierSku: true, countryCode: true, product: { select: { slug: true } } } });
      const current = new Map(variants.map((v) => [v.id, v]));
      let changedCount = 0;
      for (const rule of report.rules) {
        const variant = current.get(rule.variantId);
        if (!variant || variant.supplierSku !== rule.provenance.supplierSku || variant.countryCode !== rule.provenance.countryCode || variant.product.slug !== rule.provenance.productSlug) throw new Error(`CATALOG_CHANGED:${rule.variantId}`);
        const where = { tier_variantId: { tier: rule.tier, variantId: rule.variantId } } as const;
        const data = { mode: rule.mode, markupMicros: rule.markupMicros, fixedPriceIDR: rule.fixedPriceIDR, enabled: rule.enabled, provenance: rule.provenance };
        const existing = await tx.resellerTierSkuPrice.findUnique({ where });
        if (existing && existing.mode === data.mode && existing.markupMicros === data.markupMicros && existing.fixedPriceIDR === data.fixedPriceIDR && existing.enabled === data.enabled) continue;
        await tx.resellerTierSkuPrice.upsert({ where, update: { ...data, revision: { increment: 1 } }, create: { tier: rule.tier, variantId: rule.variantId, ...data } });
        changedCount++;
      }
      await tx.appLog.create({ data: {
        category: "ADMIN", level: "INFO", title: "Reseller tier pricing import applied",
        actor: "pricing-import-cli", route: "reseller-pricing:import",
        metadata: { rulesCount: report.rules.length, changedCount, artifactSha256: sha(JSON.stringify(report.rules)), generatedAt: report.generatedAt },
      } });
    }, { isolationLevel: "Serializable", timeout: 60_000 });
  } finally { await prisma.$disconnect(); }
}
async function main() {
  const sourceDir = resolve(arg("--source-dir") ?? join(homedir(), "Downloads"));
  const outputArg = arg("--output");
  if (!outputArg) throw new Error("--output is required");
  const output = assertOutputOutsideRepo(outputArg);
  const snapshotPath = arg("--snapshot");
  const rulesFileArg = arg("--rules-file");
  const rulesFile = rulesFileArg ? resolve(rulesFileArg) : undefined;
  const apply = process.argv.includes("--apply");
  if (apply && snapshotPath) throw new Error("--APPLY_FORBIDDEN_WITH_SNAPSHOT");
  if (apply && !rulesFile) throw new Error("--APPLY_REQUIRES_RULES_FILE");
  let report: RuleReport;
  if (rulesFile) report = readRulesFile(rulesFile);
  else {
    const catalog = await loadCatalog(snapshotPath);
    const parsed = readWorkbookRules(sourceDir, catalog);
    const skippedCounts: Record<string, number> = {};
    for (const item of parsed.skipped) {
      const reason = (item as { reason: string }).reason;
      skippedCounts[reason] = (skippedCounts[reason] ?? 0) + 1;
    }
    report = { schemaHash: schemaHash(), generatedAt: new Date().toISOString(), sourceDir,
      rules: parsed.rules, blocked: parsed.blocked,
      skipped: parsed.skipped.filter((item) => !["CATEGORY_NOT_ALLOWED", "BLANK_ROW"].includes((item as { reason: string }).reason)),
      skippedCounts,
    };
  }
  if (rulesFile && output === rulesFile) throw new Error("OUTPUT_MUST_NOT_OVERWRITE_RULES_FILE");
  writeFileSync(output, JSON.stringify({ ...report, dryRun: !apply, applied: false }, null, 2) + "\n", { mode: 0o600 });
  if (apply) {
    await applyRules(report);
    writeFileSync(output, JSON.stringify({ ...report, dryRun: false, applied: true, appliedAt: new Date().toISOString() }, null, 2) + "\n", { mode: 0o600 });
    console.log(`Applied ${report.rules.length} validated tier rules; report: ${output}`);
  } else console.log(`Validated ${report.rules.length} rules; skipped ${report.skipped.length}; blocked ${report.blocked.length}; report: ${output}`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
