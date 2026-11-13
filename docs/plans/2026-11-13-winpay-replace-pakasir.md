# WinPay menggantikan Pakasir — Rencana Implementasi

> **Untuk Claude:** REQUIRED SUB-SKILL: gunakan `superpowers:executing-plans` untuk mengeksekusi plan ini task-per-task.

**Goal:** Mengganti seluruh kanal pembayaran IDR (Pakasir) dengan WinPay Checkout Page — di storefront retail, portal reseller/B2B, dan bot Telegram — tanpa melonggarkan aturan verifikasi pembayaran yang sudah ada.

**Arsitektur:** WinPay Checkout Page adalah hosted checkout: kita membuat invoice lewat `POST /api/create` (ditandatangani HMAC-SHA256 atas timestamp), mengirim pembeli ke `responseData.redirect_url`, lalu mengonfirmasi pembayaran dengan **memverifikasi ulang** ke `GET /api/find/{id}` karena callback WinPay tidak membawa signature. Pola ini sama persis dengan adapter Pakasir yang sudah terbukti aman: callback hanyalah notifikasi, sumber kebenaran selalu respons API yang terautentikasi. Adapter baru hidup di `packages/payments/src/winpay.ts`; orkestrasi order tetap di `apps/web/src/lib/payment-orders.ts`.

**Tech Stack:** Next.js 16 (route handlers), Prisma + PostgreSQL, Node 22 (`node --test` dengan `--experimental-strip-types`), TypeScript, pnpm workspace (`@kupon/payments`, `@kupon/db`, `@kupon/ui`).

**Keputusan yang sudah dikunci di sesi 2026-11-13:**

1. Jalur integrasi: **Checkout Page (hosted)**. SNAP API (VA/QRIS langsung, RSA) **tidak** dikerjakan di plan ini.
2. Posisi: **WinPay menggantikan Pakasir sepenuhnya** — bukan metode ketiga. UI tetap 2 pilihan: Stablecoin dan WinPay.
3. Cakupan: **retail + reseller/B2B**. Nomor 2 berlaku di keduanya.

> **AMANDEMEN 2026-11-13 (di tengah eksekusi).** User memutuskan Pakasir **tetap
> aktif** sampai WinPay selesai diimplementasi; Pakasir akan dimatikan
> belakangan lewat toggle admin settings, bukan lewat penghapusan kode. Plan ini
> karena itu dieksekusi **secara aditif**, bukan menggantikan:
>
> - WinPay ditambahkan sebagai metode **ketiga** di retail, B2B, dan bot Telegram.
> - Seluruh kode, route, setting, dan enum Pakasir dipertahankan apa adanya.
> - Migrasi `B2BPaymentMethod` memakai `ADD VALUE 'WINPAY'`, bukan `RENAME`.
> - Task 16 (hapus Pakasir) **dibatalkan**; penggantinya adalah toggle admin
>   `Pakasir (retail)` / `Pakasir (reseller)`.
> - Judul file memakai kata "replace" demi riwayat; task di bawah tetap berguna
>   sebagai referensi bentuk implementasi WinPay.
>
> Status: Task 2–15 dieksekusi dengan penyesuaian di atas. Detail hasil,
> verifikasi, dan sisa pekerjaan ada di
> `docs/session-notes/2026-11-13-winpay-payment-addition.md`.

---

## Ringkasan kontrak WinPay Checkout Page

Sumber: <https://docs.winpay.id/payments/checkout-page/overview>, `/signature-generation`, `/create-invoice`, `/find-invoice`, `/callback`.

| Item | Nilai |
|---|---|
| Base URL produksi | `https://checkout.winpay.id` |
| Base URL sandbox | `https://sandbox-checkout.winpay.id` |
| Header wajib | `X-Winpay-Timestamp`, `X-Winpay-Signature`, `X-Winpay-Key`, `Content-Type: application/json` |
| Format timestamp | `YYYY-MM-DDTHH:mm:ss+07:00` (waktu Jakarta, **bukan** ISO Z) |
| Signature request | `hash_hmac('sha256', timestamp, secretKey)` → hex lowercase |
| Buat invoice | `POST /api/create` |
| Cek invoice | `GET /api/find/{id}` |
| Sukses buat | `responseCode` diawali `"2"`, data di `responseData` |
| Callback | `POST` ke URL listener, **tanpa signature**; harus dijawab string `ACCEPTED` (retry 3×) |
| Status invoice | contoh dokumentasi: `"PAID"`; status lain tidak didokumentasikan → normalisasi defensif |

Bentuk body create invoice yang kita pakai — satu baris produk dengan `qty: 1` dan `price` = total order, supaya `amount` yang dikembalikan provider selalu sama persis dengan `Order.totalIDR` (tanpa pembulatan per-unit):

```json
{
  "customer": { "name": "Buyer", "email": "buyer@example.com", "phone": "08000000000" },
  "invoice": {
    "ref": "<order.id>",
    "products": [{ "name": "Mobile Legends 86 Diamonds", "qty": 1, "price": 25000 }]
  },
  "back_url": "https://eztopup.io/order/success?orderId=<order.id>",
  "interval": 60
}
```

---

## Env baru (server-only)

Tambahkan ke `.env` produksi **dan** `.env.local` developer:

```
WINPAY_ENABLED=false
WINPAY_KEY=<client key dari dashboard WinPay>
WINPAY_SECRET_KEY=<secret key dari dashboard WinPay>
# opsional; default produksi. Isi https://sandbox-checkout.winpay.id untuk uji coba.
WINPAY_BASE_URL=
```

Aturan yang tidak boleh dilanggar (sama seperti Pakasir):

- `WINPAY_ENABLED` default **false** (fail-safe). Tanpa env ini tidak ada checkout IDR.
- `WINPAY_KEY` dan `WINPAY_SECRET_KEY` tidak boleh muncul di endpoint publik, props client, log, URL, atau respons webhook.
- Admin switch hanya bisa **mematikan**, tidak bisa menyalakan kalau env belum lengkap.

---

## Pertanyaan yang WAJIB diverifikasi di sandbox sebelum production (Task 14)

Dokumentasi WinPay tidak lengkap di titik-titik ini. Jangan menebak; uji di sandbox dan catat hasilnya di session note.

1. **`customer.phone` wajib** padahal kita tidak mengumpulkan nomor HP. Rencana: kirim placeholder `08000000000` lewat parameter `customerPhone`. Kalau WinPay menolak, tambahkan field telepon di checkout (jangan hack).
2. **`ref` di callback ambigu.** Contoh dokumentasi menunjukkan `ref` level atas (`"21125"`) berbeda dengan `invoice.ref` (`"1172164-1668397659"`). Parser kita mengambil keduanya dan mencoba keduanya sebagai `Order.id`.
3. **Batas `interval`.** Kirim `PAYMENT_INVOICE_EXPIRY_MINUTES` (default 60), dijepit 5–1440 menit. Konfirmasi penerimaan nilai ini.
4. **String status selain `PAID`** (`EXPIRED`? `CANCELLED`? `UNPAID`?). Normalisasi kita defensif: hanya token yang dikenal yang memindahkan status, sisanya `pending`.
5. **`payment.nett` vs `payment.paid_amount`.** Verifikasi jumlah memakai jumlah `products[].price` (nilai tagihan) + `payment.nett` sebagai pembanding silang; `paid_amount` boleh lebih besar karena fee.

---

## FASE 0 — Persiapan (manual, tanpa kode)

### Task 1: Konfigurasi dashboard WinPay + drain Pakasir

**Files:** tidak ada (pekerjaan dashboard + catatan).

**Step 1: Isi kredensial di dashboard WinPay**

Buka *Setting Checkout Page Credential* (screenshot 2026-11-13 07.47.00) dan isi:

- **Store Name:** `EZTopUp`
- **URL Callback:** `https://eztopup.io/api/payment/winpay/callback`
  (sandbox: `https://<preview-domain>/api/payment/winpay/callback`)
- **URL Logo:** `https://eztopup.io/logo.png` (cek dulu file yang benar-benar ada di `apps/web/public`)
- **Preview Logo:** pastikan gambar termuat, bukan broken image.

Halaman *Setting API SNAP (BI) Credential* **tidak perlu diisi** untuk plan ini (itu untuk SNAP API).

**Step 2: Catat kredensial**

Salin `Key` dan `Secret Key` ke password manager. **Jangan** tulis di dokumentasi repo.

**Step 3: Drain Pakasir (H-3 sebelum deploy pembersihan)**

```bash
# di VPS, edit .env
PAKASIR_ENABLED=false
pm2 restart eztu --update-env
```

Tunggu sampai order `PENDING` dengan `paymentProvider = 'pakasir'` berumur > 2 jam (semua invoice Pakasir kedaluwarsa jauh sebelum itu). Verifikasi dengan query di Prisma Studio / `psql`:

```sql
SELECT count(*) FROM "Order"
WHERE "paymentProvider" = 'pakasir' AND "status" = 'PENDING';
```

Expected: `0` (atau hanya order < 2 jam).

**Step 4: Catat tanggal drain**

Tulis tanggal drain di session note. Pembersihan kode Pakasir (Task 16) dieksekusi **paling cepat 14 hari** setelah drain.

---

## FASE 1 — Adapter `@kupon/payments`

### Task 2: Signature, timestamp, dan gating konfigurasi

**Files:**
- Create: `packages/payments/src/winpay.ts`
- Test: `packages/payments/src/winpay.test.ts`

**Step 1: Tulis test yang gagal**

```ts
// packages/payments/src/winpay.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import {
  createWinpaySignature,
  formatWinpayTimestamp,
  getWinpayBaseUrl,
  isWinpayCheckoutEnabled,
  isWinpayConfigured,
  isWinpayEnvironmentEnabled,
} from "./winpay.ts";

function restoreEnv(name: string, previous: string | undefined) {
  if (previous === undefined) delete process.env[name];
  else process.env[name] = previous;
}

test("enables checkout only from the server environment and credentials", () => {
  const previousEnabled = process.env.WINPAY_ENABLED;
  const previousKey = process.env.WINPAY_KEY;
  const previousSecret = process.env.WINPAY_SECRET_KEY;
  try {
    process.env.WINPAY_ENABLED = "false";
    process.env.WINPAY_KEY = "client-key";
    process.env.WINPAY_SECRET_KEY = "secret-key";
    assert.equal(isWinpayConfigured(), true);
    assert.equal(isWinpayEnvironmentEnabled(), false);
    assert.equal(isWinpayCheckoutEnabled(), false);

    process.env.WINPAY_ENABLED = "true";
    assert.equal(isWinpayCheckoutEnabled(), true);

    delete process.env.WINPAY_SECRET_KEY;
    assert.equal(isWinpayConfigured(), false);
    assert.equal(isWinpayCheckoutEnabled(), false);
  } finally {
    restoreEnv("WINPAY_ENABLED", previousEnabled);
    restoreEnv("WINPAY_KEY", previousKey);
    restoreEnv("WINPAY_SECRET_KEY", previousSecret);
  }
});

test("formats the Jakarta wall clock with a +07:00 offset", () => {
  assert.equal(
    formatWinpayTimestamp(new Date("2026-11-13T00:47:12Z")),
    "2026-11-13T07:47:12+07:00",
  );
  assert.equal(
    formatWinpayTimestamp(new Date("2026-11-13T18:00:00Z")),
    "2026-11-14T01:00:00+07:00",
  );
});

test("signs the timestamp with HMAC-SHA256 hex", () => {
  const timestamp = "2026-11-13T07:47:12+07:00";
  assert.equal(
    createWinpaySignature(timestamp, "secret"),
    "2f8fc1af9ada776dfe6d826af57b12cbf0eb6d84b72bfe655bb5fe466ab4a98b",
  );
  assert.equal(
    createWinpaySignature(timestamp, "secret"),
    createHmac("sha256", "secret").update(timestamp).digest("hex"),
  );
});

test("only allows the two documented WinPay checkout origins", () => {
  const previous = process.env.WINPAY_BASE_URL;
  try {
    delete process.env.WINPAY_BASE_URL;
    assert.equal(getWinpayBaseUrl(), "https://checkout.winpay.id");

    process.env.WINPAY_BASE_URL = "https://sandbox-checkout.winpay.id";
    assert.equal(getWinpayBaseUrl(), "https://sandbox-checkout.winpay.id");

    process.env.WINPAY_BASE_URL = "https://attacker.example";
    assert.throws(() => getWinpayBaseUrl(), /checkout origin/);

    process.env.WINPAY_BASE_URL = "http://checkout.winpay.id";
    assert.throws(() => getWinpayBaseUrl(), /checkout origin/);
  } finally {
    restoreEnv("WINPAY_BASE_URL", previous);
  }
});
```

**Step 2: Jalankan test, pastikan gagal**

```bash
cd packages/payments
node --experimental-strip-types --test src/winpay.test.ts
```

Expected: FAIL — `Cannot find module './winpay.ts'`.

**Step 3: Implementasi minimal**

```ts
// packages/payments/src/winpay.ts
import { createHmac } from "node:crypto";

const WINPAY_PRODUCTION_ORIGIN = "https://checkout.winpay.id";
const WINPAY_SANDBOX_ORIGIN = "https://sandbox-checkout.winpay.id";
const WINPAY_ALLOWED_ORIGINS = [WINPAY_PRODUCTION_ORIGIN, WINPAY_SANDBOX_ORIGIN];
const WINPAY_REQUEST_TIMEOUT_MS = 10_000;
const WINPAY_MAX_RESPONSE_BYTES = 64 * 1024;
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

function requiredEnv(name: "WINPAY_KEY" | "WINPAY_SECRET_KEY") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for WinPay payments.`);
  return value;
}

export function isWinpayEnvironmentEnabled() {
  return process.env.WINPAY_ENABLED?.trim().toLowerCase() === "true";
}

export function isWinpayConfigured() {
  return Boolean(
    process.env.WINPAY_KEY?.trim() && process.env.WINPAY_SECRET_KEY?.trim(),
  );
}

export function isWinpayCheckoutEnabled() {
  return isWinpayEnvironmentEnabled() && isWinpayConfigured();
}

export function getWinpayBaseUrl() {
  const raw = process.env.WINPAY_BASE_URL?.trim() || WINPAY_PRODUCTION_ORIGIN;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("WINPAY_BASE_URL is invalid.");
  }
  if (url.protocol !== "https:" || !WINPAY_ALLOWED_ORIGINS.includes(url.origin)) {
    throw new Error("WINPAY_BASE_URL must be the WinPay checkout origin.");
  }
  return url.origin;
}

/**
 * WinPay signs the literal `X-Winpay-Timestamp` header value, and requires that
 * value to be Jakarta wall-clock time with an explicit +07:00 offset. Jakarta
 * has no DST, so a fixed +7h shift is exact and keeps this pure/testable.
 */
export function formatWinpayTimestamp(date: Date = new Date()) {
  const shifted = new Date(date.getTime() + JAKARTA_OFFSET_MS);
  return `${shifted.toISOString().slice(0, 19)}+07:00`;
}

/** PHP equivalent: hash_hmac('sha256', $timestamp, $secretKey) */
export function createWinpaySignature(timestamp: string, secretKey: string) {
  return createHmac("sha256", secretKey).update(timestamp).digest("hex");
}
```

**Step 4: Jalankan test, pastikan lulus**

```bash
cd packages/payments
node --experimental-strip-types --test src/winpay.test.ts
```

Expected: PASS — 4 tests.

**Step 5: Commit**

```bash
git add packages/payments/src/winpay.ts packages/payments/src/winpay.test.ts
git commit -m "feat(payments): add WinPay signature and timestamp helpers"
```

---

### Task 3: Create invoice, find invoice, callback parsing

**Files:**
- Modify: `packages/payments/src/winpay.ts`
- Test: `packages/payments/src/winpay.test.ts` (append)

**Step 1: Tulis test yang gagal**

```ts
// packages/payments/src/winpay.test.ts — tambahkan di akhir file
import {
  assertWinpayInvoiceMatches,
  createWinpayInvoice,
  findWinpayInvoice,
  normalizeWinpayStatus,
  parseWinpayCallback,
} from "./winpay.ts";

test("creates an invoice with signed headers and a single price line", async () => {
  const previous = {
    key: process.env.WINPAY_KEY,
    secret: process.env.WINPAY_SECRET_KEY,
    fetch: globalThis.fetch,
  };
  process.env.WINPAY_KEY = "client-key";
  process.env.WINPAY_SECRET_KEY = "secret-key";
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://checkout.winpay.id");
    assert.equal(url.pathname, "/api/create");
    assert.equal(init?.method, "POST");

    const headers = new Headers(init?.headers);
    assert.equal(headers.get("X-Winpay-Key"), "client-key");
    const timestamp = headers.get("X-Winpay-Timestamp") || "";
    assert.match(timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+07:00$/);
    assert.equal(
      headers.get("X-Winpay-Signature"),
      createHmac("sha256", "secret-key").update(timestamp).digest("hex"),
    );

    assert.deepEqual(JSON.parse(String(init?.body)), {
      customer: { name: "Buyer", email: "buyer@example.com", phone: "08000000000" },
      invoice: {
        ref: "cm-order_1",
        products: [{ name: "Mobile Legends 86 Diamonds", qty: 1, price: 25_000 }],
      },
      back_url: "https://eztopup.io/order/success?orderId=cm-order_1",
      interval: 60,
    });

    return Response.json({
      responseCode: "2010300",
      responseMessage: "Invoice created",
      responseData: {
        id: "2edff262-6228-4da1-96d7-729bf9fc85f0",
        ref: "cm-order_1",
        redirect_url: "https://checkout.winpay.id/upu90zxyid",
      },
    });
  };
  try {
    const invoice = await createWinpayInvoice({
      orderId: "cm-order_1",
      productName: "Mobile Legends 86 Diamonds",
      amountIDR: 25_000,
      customerName: "Buyer",
      customerEmail: "buyer@example.com",
      customerPhone: "08000000000",
      backUrl: "https://eztopup.io/order/success?orderId=cm-order_1",
      expiryMinutes: 60,
    });
    assert.equal(invoice.id, "2edff262-6228-4da1-96d7-729bf9fc85f0");
    assert.equal(invoice.redirectUrl, "https://checkout.winpay.id/upu90zxyid");
    assert.equal(invoice.amountIDR, 25_000);
  } finally {
    globalThis.fetch = previous.fetch;
    restoreEnv("WINPAY_KEY", previous.key);
    restoreEnv("WINPAY_SECRET_KEY", previous.secret);
  }
});

test("rejects a redirect URL outside the WinPay checkout origin", async () => {
  const previous = {
    key: process.env.WINPAY_KEY,
    secret: process.env.WINPAY_SECRET_KEY,
    fetch: globalThis.fetch,
  };
  process.env.WINPAY_KEY = "client-key";
  process.env.WINPAY_SECRET_KEY = "secret-key";
  globalThis.fetch = async () =>
    Response.json({
      responseCode: "2010300",
      responseData: {
        id: "invoice-1",
        ref: "cm-order_1",
        redirect_url: "https://attacker.example/phish",
      },
    });
  try {
    await assert.rejects(
      () =>
        createWinpayInvoice({
          orderId: "cm-order_1",
          productName: "x",
          amountIDR: 25_000,
          customerName: "Buyer",
          customerEmail: "buyer@example.com",
          customerPhone: "08000000000",
          backUrl: "https://eztopup.io/order/success",
          expiryMinutes: 60,
        }),
      /invalid redirect/,
    );
  } finally {
    globalThis.fetch = previous.fetch;
    restoreEnv("WINPAY_KEY", previous.key);
    restoreEnv("WINPAY_SECRET_KEY", previous.secret);
  }
});

test("fails closed on a non-2xx response code", async () => {
  const previous = {
    key: process.env.WINPAY_KEY,
    secret: process.env.WINPAY_SECRET_KEY,
    fetch: globalThis.fetch,
  };
  process.env.WINPAY_KEY = "client-key";
  process.env.WINPAY_SECRET_KEY = "secret-key";
  globalThis.fetch = async () =>
    Response.json({ responseCode: "4010300", responseMessage: "Invalid signature" });
  try {
    await assert.rejects(
      () => findWinpayInvoice({ invoiceId: "2edff262-6228-4da1-96d7-729bf9fc85f0" }),
      /WinPay API error: 4010300 Invalid signature/,
    );
  } finally {
    globalThis.fetch = previous.fetch;
    restoreEnv("WINPAY_KEY", previous.key);
    restoreEnv("WINPAY_SECRET_KEY", previous.secret);
  }
});

test("reads and normalizes a found invoice", async () => {
  const previous = {
    key: process.env.WINPAY_KEY,
    secret: process.env.WINPAY_SECRET_KEY,
    fetch: globalThis.fetch,
  };
  process.env.WINPAY_KEY = "client-key";
  process.env.WINPAY_SECRET_KEY = "secret-key";
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://checkout.winpay.id");
    assert.equal(url.pathname, "/api/find/a3ef3f93-7fcb-439a-889e-14976a46492e");
    assert.equal(init?.method, "GET");
    assert.equal(new Headers(init?.headers).get("X-Winpay-Key"), "client-key");
    return Response.json({
      responseCode: "2000300",
      responseMessage: "Invoice Found",
      responseData: {
        id: "a3ef3f93-7fcb-439a-889e-14976a46492e",
        ref: "cm-order_1",
        status: "PAID",
        redirect_url: "https://checkout.winpay.id/HJHKvf1chmn",
        products: [
          { uuid: "p1", name: "Mobile Legends 86 Diamonds", qty: 1, price: "25000" },
        ],
        payment: { channel: "BSI", paid_amount: "26000", fee: "1000", nett: "25000" },
      },
    });
  };
  try {
    const invoice = await findWinpayInvoice({
      invoiceId: "a3ef3f93-7fcb-439a-889e-14976a46492e",
    });
    assert.equal(invoice.id, "a3ef3f93-7fcb-439a-889e-14976a46492e");
    assert.equal(invoice.ref, "cm-order_1");
    assert.equal(invoice.status, "paid");
    assert.equal(invoice.amountIDR, 25_000);
    assert.equal(invoice.paidAmountIDR, 25_000);
    assert.equal(invoice.channel, "BSI");
  } finally {
    globalThis.fetch = previous.fetch;
    restoreEnv("WINPAY_KEY", previous.key);
    restoreEnv("WINPAY_SECRET_KEY", previous.secret);
  }
});

test("normalizes undocumented provider statuses defensively", () => {
  assert.equal(normalizeWinpayStatus("PAID"), "paid");
  assert.equal(normalizeWinpayStatus("expired"), "expired");
  assert.equal(normalizeWinpayStatus("CANCELLED"), "failed");
  assert.equal(normalizeWinpayStatus("REFUNDED"), "refunded");
  assert.equal(normalizeWinpayStatus("UNPAID"), "pending");
  assert.equal(normalizeWinpayStatus(undefined), "pending");
});

test("parses the callback and tolerates both documented ref shapes", () => {
  const bothRefs = parseWinpayCallback(
    JSON.stringify({
      uuid: "40777df1-ad3d-4572-b0a3-6c90574330fa",
      ref: "cm-order_1",
      channel: "BSI",
      amount: 25000,
      invoice: {
        uuid: "40777df1-ad3d-4572-b0a3-6c90574330fa",
        ref: "cm-order_1",
        url: "https://checkout.winpay.id/ilhwj3z75x5",
      },
    }),
  );
  assert.equal(bothRefs.ref, "cm-order_1");
  assert.equal(bothRefs.invoiceRef, "cm-order_1");
  assert.equal(bothRefs.invoiceId, "40777df1-ad3d-4572-b0a3-6c90574330fa");
  assert.equal(bothRefs.amountIDR, 25_000);
  assert.equal(bothRefs.channel, "BSI");

  const nestedOnly = parseWinpayCallback(
    JSON.stringify({ uuid: "u1", invoice: { uuid: "u1", ref: "cm-order_2" } }),
  );
  assert.equal(nestedOnly.ref, null);
  assert.equal(nestedOnly.invoiceRef, "cm-order_2");
});

test("fails closed on ref, amount, or status mismatch", () => {
  const invoice = {
    id: "ctx-1",
    ref: "cm-order_1",
    providerStatus: "PAID",
    status: "paid" as const,
    redirectUrl: null,
    amountIDR: 25_000,
    paidAmountIDR: 25_000,
    channel: "BSI",
    raw: {},
  };
  assertWinpayInvoiceMatches({
    invoice,
    orderId: "cm-order_1",
    amountIDR: 25_000,
    requirePaid: true,
  });
  assert.throws(
    () =>
      assertWinpayInvoiceMatches({
        invoice: { ...invoice, ref: "cm-order_2", amountIDR: 24_999, status: "pending" },
        orderId: "cm-order_1",
        amountIDR: 25_000,
        requirePaid: true,
      }),
    /ref, amount, status/,
  );
});
```

**Step 2: Jalankan test, pastikan gagal**

```bash
cd packages/payments
node --experimental-strip-types --test src/winpay.test.ts
```

Expected: FAIL — export `createWinpayInvoice` tidak ada.

**Step 3: Implementasi**

Tambahkan ke `packages/payments/src/winpay.ts` (lanjutan file):

```ts
const WINPAY_ID_PATTERN = /^[A-Za-z0-9_-]{3,64}$/;
const WINPAY_REF_PATTERN = /^[A-Za-z0-9_-]{3,64}$/;
const MAX_INVOICE_IDR = 99_999_999_999;

export type WinpayInvoiceStatus =
  | "pending"
  | "paid"
  | "expired"
  | "failed"
  | "refunded";

export type WinpayInvoice = {
  id: string;
  ref: string;
  providerStatus: string;
  status: WinpayInvoiceStatus;
  redirectUrl: string | null;
  amountIDR: number;
  paidAmountIDR: number | null;
  channel: string | null;
  raw: unknown;
};

export type WinpayCallbackNotification = {
  ref: string | null;
  invoiceRef: string | null;
  invoiceId: string | null;
  amountIDR: number | null;
  channel: string | null;
  raw: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("WinPay payload must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

function optionalString(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredString(row: Record<string, unknown>, key: string) {
  const value = optionalString(row, key);
  if (!value) throw new Error(`WinPay payload is missing ${key}.`);
  return value;
}

function toIntegerIDR(value: unknown) {
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("WinPay payload contains an invalid amount.");
  }
  return amount;
}

function validateAmountIDR(amountIDR: number) {
  if (
    !Number.isSafeInteger(amountIDR) ||
    amountIDR <= 0 ||
    amountIDR > MAX_INVOICE_IDR
  ) {
    throw new Error("WinPay amount must be a positive integer in IDR.");
  }
  return amountIDR;
}

function validateRef(ref: string) {
  const cleaned = ref.trim();
  if (!WINPAY_REF_PATTERN.test(cleaned)) {
    throw new Error("WinPay invoice ref is invalid.");
  }
  return cleaned;
}

function validateInvoiceId(id: string) {
  const cleaned = id.trim();
  if (!WINPAY_ID_PATTERN.test(cleaned)) {
    throw new Error("WinPay invoice ID is invalid.");
  }
  return cleaned;
}

function sanitizeText(value: string, maxLength: number) {
  const cleaned = value.replace(/\s+/g, " ").trim().slice(0, maxLength);
  if (!cleaned) throw new Error("WinPay customer name is required.");
  return cleaned;
}

function sanitizePhone(value: string) {
  const cleaned = value.replace(/[^\d+]/g, "").slice(0, 20);
  if (!cleaned) throw new Error("WinPay customer phone is required.");
  return cleaned;
}

export function normalizeWinpayStatus(status: string | undefined): WinpayInvoiceStatus {
  switch ((status || "").trim().toUpperCase()) {
    case "PAID":
    case "SUCCESS":
    case "SETTLED":
      return "paid";
    case "EXPIRED":
      return "expired";
    case "CANCELLED":
    case "CANCELED":
    case "FAILED":
    case "DENIED":
      return "failed";
    case "REFUNDED":
      return "refunded";
    default:
      return "pending";
  }
}

async function requestWinpay(
  path: string,
  options: { method: "GET" | "POST"; body?: string },
) {
  const timestamp = formatWinpayTimestamp();
  const response = await fetch(new URL(path, getWinpayBaseUrl()), {
    method: options.method,
    ...(options.body ? { body: options.body } : {}),
    cache: "no-store",
    redirect: "error",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Winpay-Timestamp": timestamp,
      "X-Winpay-Signature": createWinpaySignature(
        timestamp,
        requiredEnv("WINPAY_SECRET_KEY"),
      ),
      "X-Winpay-Key": requiredEnv("WINPAY_KEY"),
    },
    signal: AbortSignal.timeout(WINPAY_REQUEST_TIMEOUT_MS),
  });

  const declaredLength = Number(response.headers.get("content-length") || "0");
  if (declaredLength > WINPAY_MAX_RESPONSE_BYTES) {
    throw new Error("WinPay API response is too large.");
  }
  const responseText = await response.text();
  if (Buffer.byteLength(responseText, "utf8") > WINPAY_MAX_RESPONSE_BYTES) {
    throw new Error("WinPay API response is too large.");
  }

  let data: Record<string, unknown> | null = null;
  try {
    data = asRecord(JSON.parse(responseText) as unknown);
  } catch {
    data = null;
  }
  if (!response.ok || !data) {
    throw new Error(`WinPay API error: ${response.status} Unknown API error`);
  }
  const responseCode = optionalString(data, "responseCode") || "";
  if (!responseCode.startsWith("2")) {
    const message = optionalString(data, "responseMessage") || "Unknown API error";
    throw new Error(`WinPay API error: ${responseCode || response.status} ${message}`);
  }
  return asRecord(data.responseData);
}

function assertWinpayCheckoutUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("WinPay API returned an invalid redirect URL.");
  }
  if (url.protocol !== "https:" || !WINPAY_ALLOWED_ORIGINS.includes(url.origin)) {
    throw new Error("WinPay API returned an invalid redirect URL.");
  }
  return url.toString();
}

export async function createWinpayInvoice(params: {
  orderId: string;
  productName: string;
  amountIDR: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  backUrl: string;
  expiryMinutes: number;
}) {
  const ref = validateRef(params.orderId);
  const amountIDR = validateAmountIDR(params.amountIDR);
  const interval = Math.min(1440, Math.max(5, Math.trunc(params.expiryMinutes) || 60));
  const body = JSON.stringify({
    customer: {
      name: sanitizeText(params.customerName, 50),
      email: params.customerEmail.trim().slice(0, 100),
      phone: sanitizePhone(params.customerPhone),
    },
    invoice: {
      ref,
      products: [
        {
          name: sanitizeText(params.productName, 100),
          qty: 1,
          price: amountIDR,
        },
      ],
    },
    back_url: params.backUrl,
    interval,
  });

  const row = await requestWinpay("/api/create", { method: "POST", body });
  const id = validateInvoiceId(requiredString(row, "id"));
  const redirectUrl = assertWinpayCheckoutUrl(requiredString(row, "redirect_url"));

  return { id, ref, redirectUrl, amountIDR };
}

function sumProductAmounts(row: Record<string, unknown>) {
  const products = row.products;
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error("WinPay payload is missing products.");
  }
  let total = 0;
  for (const entry of products) {
    const product = asRecord(entry);
    const qty = Number(product.qty);
    const price = Number(product.price);
    if (!Number.isSafeInteger(qty) || qty <= 0 || !Number.isSafeInteger(price) || price <= 0) {
      throw new Error("WinPay payload contains an invalid product line.");
    }
    total += qty * price;
  }
  return total;
}

function parseInvoice(value: unknown): WinpayInvoice {
  const row = asRecord(value);
  const payment = row.payment ? asRecord(row.payment) : null;
  const providerStatus = (optionalString(row, "status") || "PENDING").toUpperCase();
  // `nett` is what the merchant receives; `paid_amount` may include the fee.
  const nett = payment ? optionalString(payment, "nett") : null;
  const rawRedirect = optionalString(row, "redirect_url");

  return {
    id: validateInvoiceId(requiredString(row, "id")),
    ref: requiredString(row, "ref"),
    providerStatus,
    status: normalizeWinpayStatus(providerStatus),
    redirectUrl: rawRedirect ? assertWinpayCheckoutUrl(rawRedirect) : null,
    amountIDR: sumProductAmounts(row),
    paidAmountIDR: nett ? toIntegerIDR(nett) : null,
    channel: payment ? optionalString(payment, "channel") : null,
    raw: value,
  };
}

export async function findWinpayInvoice(params: {
  invoiceId: string;
}): Promise<WinpayInvoice> {
  const id = validateInvoiceId(params.invoiceId);
  return parseInvoice(
    await requestWinpay(`/api/find/${encodeURIComponent(id)}`, { method: "GET" }),
  );
}

export function parseWinpayCallback(rawBody: string): WinpayCallbackNotification {
  const body = asRecord(JSON.parse(rawBody) as unknown);
  const invoice = body.invoice ? asRecord(body.invoice) : null;
  const amount = body.amount;
  const parsedAmount =
    typeof amount === "number"
      ? amount
      : typeof amount === "string" && amount.trim()
        ? Number(amount)
        : Number.NaN;

  return {
    ref: optionalString(body, "ref"),
    invoiceRef: invoice ? optionalString(invoice, "ref") : null,
    invoiceId:
      optionalString(body, "uuid") ||
      (invoice ? optionalString(invoice, "uuid") : null),
    amountIDR:
      Number.isSafeInteger(parsedAmount) && parsedAmount > 0 ? parsedAmount : null,
    channel: optionalString(body, "channel"),
    raw: body,
  };
}

export function assertWinpayInvoiceMatches(params: {
  invoice: WinpayInvoice;
  orderId: string;
  amountIDR: number;
  requirePaid?: boolean;
}) {
  const expectedOrderId = validateRef(params.orderId);
  const expectedAmount = validateAmountIDR(params.amountIDR);
  const mismatches: string[] = [];
  if (params.invoice.ref !== expectedOrderId) mismatches.push("ref");
  if (params.invoice.amountIDR !== expectedAmount) mismatches.push("amount");
  if (params.requirePaid && params.invoice.status !== "paid") mismatches.push("status");
  if (mismatches.length > 0) {
    throw new Error(`WinPay invoice mismatch: ${mismatches.join(", ")}.`);
  }
}
```

**Step 4: Jalankan test, pastikan lulus**

```bash
cd packages/payments
node --experimental-strip-types --test src/winpay.test.ts
```

Expected: PASS — 12 tests, 0 fail.

**Step 5: Commit**

```bash
git add packages/payments/src/winpay.ts packages/payments/src/winpay.test.ts
git commit -m "feat(payments): add WinPay checkout page client"
```

---

### Task 4: Ekspor adapter + perluas tipe provider

**Files:**
- Modify: `packages/payments/src/index.ts:5` dan blok `export { ... } from "./pakasir"` di akhir file.

**Step 1: Ubah tipe provider**

```ts
// packages/payments/src/index.ts:5
export type PaymentProvider = "cryptomus" | "pakasir" | "winpay";
```

`"pakasir"` **tetap** ada selama masa drain karena baris `Order` lama masih memakainya.

**Step 2: Tambahkan ekspor**

```ts
// packages/payments/src/index.ts — setelah blok ekspor pakasir
export {
  assertWinpayInvoiceMatches,
  createWinpayInvoice,
  createWinpaySignature,
  findWinpayInvoice,
  formatWinpayTimestamp,
  getWinpayBaseUrl,
  isWinpayCheckoutEnabled,
  isWinpayConfigured,
  isWinpayEnvironmentEnabled,
  normalizeWinpayStatus,
  parseWinpayCallback,
  type WinpayCallbackNotification,
  type WinpayInvoice,
  type WinpayInvoiceStatus,
} from "./winpay";
```

**Step 3: Verifikasi seluruh paket**

```bash
cd packages/payments
node --experimental-strip-types --test src/*.test.ts
pnpm typecheck
```

Expected: semua test lulus (pakasir + winpay), typecheck bersih.

**Step 4: Commit**

```bash
git add packages/payments/src/index.ts
git commit -m "feat(payments): export WinPay adapter and provider type"
```

---

## FASE 2 — Konfirmasi pembayaran di web app

### Task 5: Generalisasi provider IDR + label bersama

**Files:**
- Create: `apps/web/src/lib/payment-provider.ts`
- Create: `apps/web/src/lib/payment-provider.test.ts`
- Modify: `apps/web/src/lib/payment-orders.ts:19-26, 204-221, 403-404`
- Modify: `apps/web/src/lib/fulfillment.ts:338-347`

**Step 1: Tulis test yang gagal**

```ts
// apps/web/src/lib/payment-provider.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  isIdrPaymentProvider,
  paymentProviderLabel,
  resolveProviderAmount,
} from "./payment-provider.ts";

test("treats both Indonesian providers as IDR", () => {
  assert.equal(isIdrPaymentProvider("winpay"), true);
  assert.equal(isIdrPaymentProvider("pakasir"), true);
  assert.equal(isIdrPaymentProvider("cryptomus"), false);
  assert.equal(isIdrPaymentProvider(null), false);
  assert.equal(isIdrPaymentProvider(undefined), false);
});

test("labels every provider including legacy rows", () => {
  assert.equal(paymentProviderLabel("winpay"), "WinPay");
  assert.equal(paymentProviderLabel("pakasir"), "Pakasir");
  assert.equal(paymentProviderLabel("cryptomus"), "Cryptomus");
  assert.equal(paymentProviderLabel(null), "—");
});

test("reads the verified IDR amount from the provider payload", () => {
  assert.deepEqual(
    resolveProviderAmount({ provider: "winpay", raw: {}, payAmount: 25_000 }),
    { amount: 25_000, currency: "IDR" },
  );
  assert.deepEqual(
    resolveProviderAmount({
      provider: "pakasir",
      raw: { amount: 22_000 },
      payAmount: null,
    }),
    { amount: 22_000, currency: "IDR" },
  );
  assert.deepEqual(
    resolveProviderAmount({
      provider: "cryptomus",
      raw: { price_amount: "12.50" },
      payAmount: null,
    }),
    { amount: 12.5, currency: "USD" },
  );
  assert.equal(resolveProviderAmount({ provider: "winpay", raw: {} }), null);
});
```

**Step 2: Jalankan test, pastikan gagal**

```bash
cd apps/web
node --experimental-strip-types --test src/lib/payment-provider.test.ts
```

Expected: FAIL — `Cannot find module './payment-provider.ts'`.

**Step 3: Implementasi modul**

```ts
// apps/web/src/lib/payment-provider.ts
/**
 * Both Pakasir and WinPay settle in integer IDR. Keeping the set in one place
 * stops the amount-integrity check from silently becoming USD-only.
 */
const IDR_PAYMENT_PROVIDERS = new Set(["pakasir", "winpay"]);

export function isIdrPaymentProvider(provider: string | null | undefined) {
  return Boolean(provider && IDR_PAYMENT_PROVIDERS.has(provider));
}

const PROVIDER_LABELS: Record<string, string> = {
  winpay: "WinPay",
  // Legacy rows created before WinPay replaced Pakasir.
  pakasir: "Pakasir",
  cryptomus: "Cryptomus",
};

export function paymentProviderLabel(provider: string | null | undefined) {
  if (!provider) return "—";
  return PROVIDER_LABELS[provider] || provider;
}

function readNumber(raw: unknown, key: string) {
  if (!raw || typeof raw !== "object") return null;
  const value = (raw as Record<string, unknown>)[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * The expected amount in the order's own currency. WinPay's verified payload
 * has no top-level `amount`, so the caller passes the verified `payAmount`.
 */
export function resolveProviderAmount(params: {
  provider: string;
  raw: unknown;
  payAmount?: number | null;
}) {
  if (isIdrPaymentProvider(params.provider)) {
    const amount =
      readNumber(params.raw, "price_amount") ??
      readNumber(params.raw, "amount") ??
      (typeof params.payAmount === "number" && Number.isFinite(params.payAmount)
        ? params.payAmount
        : null);
    return amount === null ? null : { amount, currency: "IDR" as const };
  }
  const amount =
    readNumber(params.raw, "price_amount") ??
    readNumber(params.raw, "payment_amount_usd");
  return amount === null ? null : { amount, currency: "USD" as const };
}
```

**Step 4: Jalankan test, pastikan lulus**

```bash
cd apps/web
node --experimental-strip-types --test src/lib/payment-provider.test.ts
```

Expected: PASS — 3 tests.

**Step 5: Pakai di `payment-orders.ts`**

Ganti blok pemeriksaan jumlah (baris 204–221) menjadi:

```ts
  // Cryptomus amounts are USD; WinPay and legacy Pakasir amounts are integer IDR.
  const providerAmount = resolveProviderAmount({
    provider: event.provider,
    raw: event.raw,
    payAmount: event.payAmount,
  });
  if (event.status === "paid" && providerAmount) {
    const expectedAmount =
      providerAmount.currency === "IDR" ? order.totalIDR : order.totalUSD;
    const amountMatches =
      providerAmount.currency === "IDR"
        ? providerAmount.amount === expectedAmount
        : Math.abs(providerAmount.amount - expectedAmount) <= 0.05;
    if (!amountMatches) {
      orderIntegrityReasons.push(
        `Provider amount=${providerAmount.amount} does not match order ${providerAmount.currency === "IDR" ? "totalIDR" : "totalUSD"}=${expectedAmount}`,
      );
    }
  }
```

Dan ganti label notifikasi (baris 403–404):

```ts
        paymentGateway: paymentProviderLabel(event.provider),
```

Tambahkan import di kepala file:

```ts
import { paymentProviderLabel, resolveProviderAmount } from "@/lib/payment-provider";
```

**Step 6: Pakai di `fulfillment.ts`**

Ganti ternary `order.paymentProvider === "pakasir" ? "Pakasir" : ...` (baris 338–347) dengan:

```ts
      paymentGateway: paymentProviderLabel(order.paymentProvider),
```

Tambahkan import:

```ts
import { paymentProviderLabel } from "@/lib/payment-provider";
```

**Step 7: Typecheck + commit**

```bash
cd apps/web && pnpm typecheck
git add src/lib/payment-provider.ts src/lib/payment-provider.test.ts src/lib/payment-orders.ts src/lib/fulfillment.ts
git commit -m "refactor(payments): share IDR provider amount and label rules"
```

---

### Task 6: Verifier WinPay (webhook + sync)

**Files:**
- Create: `apps/web/src/lib/winpay-payment.ts`

Pola 1:1 dengan `src/lib/pakasir-payment.ts` — baca file itu sebelum menulis.

**Step 1: Implementasi**

```ts
// apps/web/src/lib/winpay-payment.ts
import "server-only";

import { Prisma, prisma } from "@kupon/db";
import {
  assertWinpayInvoiceMatches,
  findWinpayInvoice,
  type PaymentWebhookEvent,
  type WinpayCallbackNotification,
} from "@kupon/payments";
import { applyPaymentEventToOrder } from "@/lib/payment-orders";
import type { FraudRequestContext } from "@/lib/fraud";
import { applyB2BPaymentEvent } from "@/lib/b2b-order-service";

const VERIFICATION_COOLDOWN_MS = 5_000;

async function reserveWinpayVerification(
  orderId: string,
  source: string,
  isReseller: boolean,
) {
  const now = new Date();
  const eventId = `verification:${orderId}`;
  try {
    await prisma.paymentEvent.create({
      data: {
        provider: "winpay",
        eventId,
        eventType: "invoice.verify",
        providerPaymentId: orderId,
        orderId: isReseller ? null : orderId,
        processedAt: now,
        payload: { source },
      },
    });
    return true;
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002"
    ) {
      throw error;
    }
  }
  const claimed = await prisma.paymentEvent.updateMany({
    where: {
      provider: "winpay",
      eventId,
      OR: [
        { processedAt: null },
        { processedAt: { lt: new Date(now.getTime() - VERIFICATION_COOLDOWN_MS) } },
      ],
    },
    data: { processedAt: now, payload: { source } },
  });
  return claimed.count === 1;
}

export async function verifyAndApplyWinpayPayment(params: {
  orderId: string;
  notification?: WinpayCallbackNotification;
  requestContext?: FraudRequestContext;
  source: "webhook" | "sync";
  actorUserId?: string;
  actorClerkUserId?: string;
}) {
  const consumerOrder = await prisma.order.findUnique({
    where: { id: params.orderId },
    select: {
      id: true,
      status: true,
      totalIDR: true,
      paymentProvider: true,
      paymentProviderPaymentId: true,
    },
  });
  const resellerOrder = consumerOrder
    ? null
    : await prisma.b2BOrder.findUnique({
        where: { id: params.orderId },
        select: {
          id: true,
          status: true,
          paymentIntent: {
            select: { provider: true, providerPaymentId: true, amountIDR: true },
          },
        },
      });
  const intent = resellerOrder?.paymentIntent;
  const order =
    consumerOrder ??
    (resellerOrder && intent
      ? {
          id: resellerOrder.id,
          status: resellerOrder.status,
          totalIDR: Number(intent.amountIDR),
          paymentProvider: intent.provider,
          paymentProviderPaymentId: intent.providerPaymentId,
        }
      : null);
  if (!order) {
    return { ok: false as const, status: 404, error: "Order not found" };
  }
  if (order.paymentProvider !== "winpay") {
    return { ok: false as const, status: 409, error: "Payment provider mismatch" };
  }

  if (["PAID", "PROCESSING", "COMPLETED"].includes(order.status)) {
    return {
      ok: true as const,
      orderId: order.id,
      previousStatus: order.status,
      status: order.status,
      providerStatus: "already_confirmed",
      applied: false as const,
    };
  }

  const invoiceId = order.paymentProviderPaymentId;
  if (!invoiceId) {
    return { ok: false as const, status: 409, error: "WinPay invoice ID is missing" };
  }

  // The callback carries no signature, so it is only a hint: the authenticated
  // find-invoice call below is the source of truth.
  if (
    params.notification?.amountIDR != null &&
    params.notification.amountIDR !== order.totalIDR
  ) {
    return { ok: false as const, status: 409, error: "WinPay amount mismatch" };
  }

  const reserved = await reserveWinpayVerification(
    order.id,
    params.source,
    Boolean(resellerOrder),
  );
  if (!reserved) {
    if (params.source === "webhook") {
      return {
        ok: false as const,
        status: 503,
        error: "WinPay verification is busy; retry callback",
      };
    }
    return {
      ok: true as const,
      orderId: order.id,
      previousStatus: order.status,
      status: order.status,
      providerStatus: "verification_throttled",
      applied: false as const,
    };
  }

  const invoice = await findWinpayInvoice({ invoiceId });
  assertWinpayInvoiceMatches({
    invoice,
    orderId: order.id,
    amountIDR: order.totalIDR,
  });

  if (invoice.status !== "paid") {
    if (params.source === "webhook") {
      return {
        ok: false as const,
        status: 503,
        error: `WinPay invoice is not paid yet (${invoice.providerStatus}); retry callback`,
      };
    }
    return {
      ok: true as const,
      orderId: order.id,
      previousStatus: order.status,
      status: order.status,
      providerStatus: invoice.providerStatus,
      applied: false as const,
    };
  }

  if (resellerOrder) {
    const result = await applyB2BPaymentEvent({
      provider: "winpay",
      providerPaymentId: invoice.id,
      eventId: `${invoice.id}:${invoice.providerStatus}`,
      normalizedStatus: "paid",
      raw: invoice.raw,
    });
    const current = await prisma.b2BOrder.findUniqueOrThrow({
      where: { id: order.id },
      select: { status: true },
    });
    return {
      ok: true as const,
      orderId: order.id,
      previousStatus: order.status,
      status: current.status,
      providerStatus: invoice.providerStatus,
      applied: result.applied,
    };
  }

  const event: PaymentWebhookEvent = {
    provider: "winpay",
    providerPaymentId: invoice.id,
    providerInvoiceId: invoice.id,
    orderId: order.id,
    status: "paid",
    providerStatus: invoice.providerStatus,
    payCurrency: "IDR",
    payAmount: invoice.amountIDR,
    actuallyPaid: invoice.paidAmountIDR ?? invoice.amountIDR,
    txHash: null,
    raw: invoice.raw,
  };
  return applyPaymentEventToOrder(event, {
    requestContext: params.requestContext,
    source: params.source,
    actorUserId: params.actorUserId,
    actorClerkUserId: params.actorClerkUserId,
  });
}
```

**Step 2: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: bersih. Kalau `applyB2BPaymentEvent` masih menerima `"cryptomus" | "pakasir"` saja, ikuti Task 12 lebih dulu atau longgarkan parameternya sekarang:

```ts
// apps/web/src/lib/b2b-order-service.ts:392-393
export async function applyB2BPaymentEvent(params: {
  provider: "cryptomus" | "pakasir" | "winpay";
  ...
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/winpay-payment.ts
git commit -m "feat(payments): verify WinPay invoices before applying payment"
```

---

### Task 7: Route callback dan sync customer

**Files:**
- Create: `apps/web/src/app/api/payment/winpay/callback/route.ts`
- Create: `apps/web/src/app/api/payment/winpay/sync/route.ts`
- Create: `apps/web/src/app/api/payment/b2b/winpay/callback/route.ts`

**Step 1: Callback route**

```ts
// apps/web/src/app/api/payment/winpay/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@kupon/db";
import { parseWinpayCallback } from "@kupon/payments";
import { getRequestContext, notifySecurityEvent } from "@/lib/fraud";
import { verifyAndApplyWinpayPayment } from "@/lib/winpay-payment";

export const dynamic = "force-dynamic";

const MAX_CALLBACK_BYTES = 8 * 1024;

/** WinPay retries up to 3 times until it receives exactly this body. */
function accepted() {
  return new NextResponse("ACCEPTED", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function resolveOrderId(candidate: string | null) {
  if (!candidate) return null;
  const order = await prisma.order.findUnique({
    where: { id: candidate },
    select: { id: true },
  });
  if (order) return order.id;
  const b2b = await prisma.b2BOrder.findUnique({
    where: { id: candidate },
    select: { id: true },
  });
  return b2b?.id ?? null;
}

export async function POST(request: NextRequest) {
  const requestContext = getRequestContext(request);
  let rawBody = "";
  try {
    const declaredLength = Number(request.headers.get("content-length") || "0");
    if (declaredLength > MAX_CALLBACK_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_CALLBACK_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    const notification = parseWinpayCallback(rawBody);
    // Docs show `ref` and `invoice.ref` carrying different values; try both.
    const orderId =
      (await resolveOrderId(notification.ref)) ||
      (await resolveOrderId(notification.invoiceRef));

    if (!orderId) {
      await notifySecurityEvent({
        eventType: "winpay_callback_unknown_order",
        severity: "high",
        action: "blocked",
        reasons: [
          `ref=${notification.ref ?? "-"} invoiceRef=${notification.invoiceRef ?? "-"}`,
        ],
        requestContext,
        metadata: { amountIDR: notification.amountIDR, channel: notification.channel },
      });
      return NextResponse.json({ error: "Order not found" }, { status: 409 });
    }

    const result = await verifyAndApplyWinpayPayment({
      orderId,
      notification,
      requestContext,
      source: "webhook",
    });

    if (!result.ok) {
      if (result.status === 503) {
        return NextResponse.json({ error: result.error }, { status: 503 });
      }
      await notifySecurityEvent({
        eventType: "winpay_callback_rejected",
        severity: "high",
        action: "blocked",
        reasons: [result.error],
        requestContext,
        orderId,
        metadata: {
          invoiceId: notification.invoiceId,
          amountIDR: notification.amountIDR,
        },
      });
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return accepted();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[WinPay Callback]", message);
    await notifySecurityEvent({
      eventType: "winpay_callback_verification_failed",
      severity: "high",
      action: "blocked",
      reasons: [message],
      requestContext,
      metadata: { bodyLength: Buffer.byteLength(rawBody, "utf8") },
    });
    const unavailable =
      message.includes("WinPay API error") ||
      message.includes("aborted") ||
      message.includes("timeout");
    return NextResponse.json(
      { error: "Callback verification failed" },
      { status: unavailable ? 503 : 409 },
    );
  }
}
```

**Step 2: B2B callback re-export**

```ts
// apps/web/src/app/api/payment/b2b/winpay/callback/route.ts
export { POST } from "../../../winpay/callback/route";

export const dynamic = "force-dynamic";
```

**Step 3: Sync route untuk customer**

```ts
// apps/web/src/app/api/payment/winpay/sync/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@kupon/db";
import { AuthenticationRequiredError, requireClerkUser } from "@/lib/clerk";
import { getRequestContext } from "@/lib/fraud";
import { verifyAndApplyWinpayPayment } from "@/lib/winpay-payment";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await requireClerkUser();
    const body = (await request.json()) as { orderId?: unknown };
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    if (!orderId) {
      return NextResponse.json({ error: "orderId is required." }, { status: 400 });
    }
    const ownedOrder = await prisma.order.findFirst({
      where: { id: orderId, userId: user.dbUserId, paymentProvider: "winpay" },
      select: { id: true, status: true },
    });
    if (!ownedOrder) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    if (["PAID", "PROCESSING", "COMPLETED"].includes(ownedOrder.status)) {
      return NextResponse.json({
        success: true,
        orderId: ownedOrder.id,
        status: ownedOrder.status,
      });
    }
    const result = await verifyAndApplyWinpayPayment({
      orderId,
      requestContext: getRequestContext(request),
      source: "sync",
      actorUserId: user.dbUserId,
      actorClerkUserId: user.clerkUserId,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      success: true,
      orderId: result.orderId,
      status: result.status,
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: "Please log in." }, { status: 401 });
    }
    console.error("[WinPay Sync]", error);
    return NextResponse.json(
      { error: "Unable to verify WinPay payment." },
      { status: 503 },
    );
  }
}
```

**Step 4: Commit**

```bash
git add apps/web/src/app/api/payment/winpay apps/web/src/app/api/payment/b2b/winpay
git commit -m "feat(payments): add WinPay callback and customer sync routes"
```

---

## FASE 3 — Checkout retail

### Task 8: Tipe quote & route harga

**Files:**
- Modify: `apps/web/src/lib/fx.ts:14, 149, 161, 209`
- Modify: `apps/web/src/lib/fx.test.ts:15, 24, 31, 47`
- Modify: `apps/web/src/lib/pricing-rules.ts:1`
- Modify: `apps/web/src/app/api/pricing/quote/route.ts:19, 27-30, 84-95, 104`

**Step 1: Ganti tipe**

`fx.ts` — tiga tempat:

```ts
  paymentMethod: "winpay" | "crypto";
```

dan validasi:

```ts
    !["winpay", "crypto"].includes(params.paymentMethod) ||
```

`pricing-rules.ts:1`:

```ts
export type CheckoutPaymentMethod = "winpay" | "crypto";
```

`fx.test.ts` — ganti semua `"pakasir"` menjadi `"winpay"` (4 tempat).

**Step 2: Route quote**

```ts
// apps/web/src/app/api/pricing/quote/route.ts
import { getCryptoAvailability, isWinpayEnabledForCheckout } from "@/lib/payment-settings";
```

```ts
    const paymentMethod =
      request.nextUrl.searchParams.get("paymentMethod") === "crypto"
        ? "crypto"
        : "winpay";
```

```ts
            error:
              "Crypto payment is unavailable in your region. Please choose WinPay.",
```

```ts
    if (paymentMethod === "winpay" && !(await isWinpayEnabledForCheckout())) {
      return NextResponse.json(
        {
          error: "WinPay is currently unavailable. Please choose Crypto.",
          code: "WINPAY_UNAVAILABLE",
        },
        { status: 400 },
      );
    }
```

Baris 104 (pesan batas minimum crypto):

```ts
          { error: "This SKU needs more than 20 units to reach the crypto minimum. Choose WinPay or contact sales.", code: "CRYPTO_MINIMUM_EXCEEDS_LIMIT" },
```

`isWinpayEnabledForCheckout` dibuat di Task 10 — kerjakan Task 10 lebih dulu bila memilih urutan ini, atau buat fungsi placeholder yang mengembalikan `false`.

**Step 3: Test + typecheck**

```bash
cd apps/web
node --experimental-strip-types --test src/lib/fx.test.ts
pnpm typecheck
```

Expected: fx tests PASS (jumlah sama seperti sebelumnya), typecheck bersih setelah Task 10 selesai.

**Step 4: Commit**

```bash
git add apps/web/src/lib/fx.ts apps/web/src/lib/fx.test.ts apps/web/src/lib/pricing-rules.ts "apps/web/src/app/api/pricing/quote/route.ts"
git commit -m "refactor(pricing): quote WinPay instead of Pakasir"
```

---

### Task 9: Order creation + route checkout

**Files:**
- Modify: `apps/web/src/lib/checkout-order.ts:5, 36, 52-58, 94-97, 124, 132-180, 191-196, 214-216`
- Modify: `apps/web/src/app/api/payment/create/route.ts:64-66, 100-103, 189-194, 262-276, 414-420`

**Step 1: `checkout-order.ts`**

Import:

```ts
import { createPaymentInvoice, createWinpayInvoice, isWinpayCheckoutEnabled } from "@kupon/payments";
import { getPaymentInvoiceExpiryMinutes } from "@/lib/payment-expiry";
```

Tipe parameter:

```ts
  paymentMethod: "crypto" | "winpay";
```

Guard:

```ts
  if (!isFree && paymentMethod === "winpay" && !isWinpayCheckoutEnabled()) {
    throw new Error("WinPay is currently unavailable. Please choose Crypto.");
  }
```

`paymentProvider` saat create:

```ts
      paymentProvider:
        isFree ? null : paymentMethod === "winpay" ? "winpay" : "cryptomus",
```

Cek konsistensi order:

```ts
      order.paymentProvider !== (isFree ? null : paymentMethod === "winpay" ? "winpay" : "cryptomus")) {
```

Cabang pembayaran IDR:

```ts
  } else if (!isFree && paymentMethod === "winpay") {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL is required.");
    const expiryMinutes = getPaymentInvoiceExpiryMinutes();
    const invoice = await createWinpayInvoice({
      orderId: order.id,
      productName: `${variant.product.name} - ${variant.name}`,
      amountIDR: totalIDR,
      customerName: email.split("@")[0] || "EZTopUp Customer",
      customerEmail: email,
      // WinPay requires a phone number; we do not collect one (see plan Task 14).
      customerPhone: "08000000000",
      backUrl: telegramChatId
        ? telegramReturnUrl()
        : `${appUrl}/order/success?orderId=${encodeURIComponent(order.id)}`,
      expiryMinutes,
    });
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentProvider: "winpay",
        paymentProviderPaymentId: invoice.id,
        paymentProviderInvoiceId: invoice.id,
        paymentCurrency: "IDR",
        paymentUrl: invoice.redirectUrl,
        expiresAt: resolvePaymentExpiresAt({
          explicitExpiresAt: new Date(now.getTime() + expiryMinutes * 60_000),
          createdAt: order.createdAt,
        }),
      },
    });
    paymentUrl = invoice.redirectUrl;
    checkout = { type: "redirect", url: invoice.redirectUrl };
  }
```

Notifikasi & log Telegram (baris 191–196 dan 214–216): ganti string `"pakasir"` / `"IDR"`:

```ts
    crypto: isFree ? "FREE/VOUCHER" : paymentMethod === "winpay" ? "IDR" : "pending",
```

```ts
      paymentGateway:
        isFree ? null : paymentMethod === "winpay" ? "winpay" : "cryptomus",
```

**Step 2: `payment/create` route**

```ts
  if (error.message.includes("WinPay") || error.message.includes("WINPAY_")) {
    return "WinPay checkout is temporarily unavailable. Please choose crypto or try again.";
  }
```

```ts
    const paymentMethod =
      body.paymentMethod === "crypto" || body.paymentMethod === "winpay"
        ? body.paymentMethod
        : null;
```

```ts
    if (!paymentMethod) {
      return NextResponse.json(
        { error: "Please choose Crypto or WinPay as your payment method." },
        { status: 400 },
      );
    }
```

Pesan crypto-unavailable (baris 267–272):

```ts
          {
            error:
              "Crypto payment is unavailable in your region. Please choose WinPay.",
            code: "CRYPTO_UNAVAILABLE_REGION",
          },
```

Gate akhir (baris 414–420):

```ts
    if (
      quote.totalUSDCents > 0 &&
      paymentMethod === "winpay" &&
      !(await isWinpayEnabledForCheckout())
    ) {
      return NextResponse.json(
        {
          error: "WinPay is currently unavailable. Please choose Crypto.",
          code: "WINPAY_UNAVAILABLE",
        },
        { status: 503 },
      );
    }
```

Import menjadi:

```ts
import { getCryptoAvailability, isWinpayEnabledForCheckout } from "@/lib/payment-settings";
```

**Step 3: Typecheck + commit**

```bash
cd apps/web && pnpm typecheck
git add apps/web/src/lib/checkout-order.ts "apps/web/src/app/api/payment/create/route.ts"
git commit -m "feat(checkout): create WinPay invoices for IDR orders"
```

---

### Task 10: Settings pembayaran + route metode

**Files:**
- Modify: `apps/web/src/lib/payment-settings.ts:2, 12-19, 46-84`
- Modify: `apps/web/src/app/api/payment/methods/route.ts`
- Modify: `apps/web/src/app/api/admin/settings/payments/route.ts`
- Modify: `apps/web/src/app/(admin)/admin/settings/PaymentsSettingsForm.tsx`
- Modify: `apps/web/src/app/(admin)/admin/settings/page.tsx:90-100`

**Step 1: `payment-settings.ts`**

```ts
import { isWinpayCheckoutEnabled } from "@kupon/payments";

export const PAYMENT_SETTING_KEYS = {
  CRYPTO_ENABLED: "payments.crypto.enabled",
  CRYPTO_DISABLED_COUNTRIES: "payments.crypto.disabledCountries",
  CRYPTO_DISABLED_UNTIL: "payments.crypto.disabledUntil",
  WINPAY_ENABLED: "payments.winpay.enabled",
  RESELLER_CRYPTO_ENABLED: "payments.reseller.crypto.enabled",
  RESELLER_WINPAY_ENABLED: "payments.reseller.winpay.enabled",
} as const;
```

Ganti seluruh pasangan fungsi Pakasir:

```ts
/**
 * The env gate (`WINPAY_ENABLED` + credentials) stays authoritative; the admin
 * switch can only turn WinPay further off, never on when the env is missing.
 */
export async function getWinpayAdminEnabled(): Promise<boolean> {
  const raw = await getSetting(PAYMENT_SETTING_KEYS.WINPAY_ENABLED, "true");
  return raw.trim().toLowerCase() !== "false";
}

export async function isWinpayEnabledForCheckout(): Promise<boolean> {
  if (!isWinpayCheckoutEnabled()) return false;
  return getWinpayAdminEnabled();
}

export async function getResellerWinpayAdminEnabled(): Promise<boolean> {
  const raw = await getSetting(PAYMENT_SETTING_KEYS.RESELLER_WINPAY_ENABLED, "true");
  return raw.trim().toLowerCase() !== "false";
}

export async function isResellerWinpayEnabledForCheckout(): Promise<boolean> {
  if (!isWinpayCheckoutEnabled()) return false;
  return getResellerWinpayAdminEnabled();
}
```

**Step 2: `methods` route**

```ts
import {
  getCryptoAvailability,
  isResellerCryptoEnabledForCheckout,
  isResellerWinpayEnabledForCheckout,
  isWinpayEnabledForCheckout,
} from "@/lib/payment-settings";
```

```ts
  const [
    cryptoAvailability,
    winpayEnabled,
    resellerCryptoEnabled,
    resellerWinpayEnabled,
  ] = await Promise.all([
    getCryptoAvailability(marketCode),
    isWinpayEnabledForCheckout(),
    isResellerCryptoEnabledForCheckout(),
    isResellerWinpayEnabledForCheckout(),
  ]);

  return NextResponse.json(
    {
      crypto: {
        enabled: cryptoAvailability.allowed,
        reason: cryptoAvailability.reason,
      },
      winpay: { enabled: winpayEnabled },
      reseller: {
        crypto: { enabled: resellerCryptoEnabled },
        winpay: { enabled: resellerWinpayEnabled },
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
```

**Step 3: Admin route**

Ganti setiap kemunculan `Pakasir` → `Winpay` pada `getPakasirAdminEnabled`, `getResellerPakasirAdminEnabled`, `PAYMENT_SETTING_KEYS.PAKASIR_ENABLED`, `PAYMENT_SETTING_KEYS.RESELLER_PAKASIR_ENABLED`, serta properti body `pakasirEnabled` → `winpayEnabled` dan `resellerPakasirEnabled` → `resellerWinpayEnabled`. Bentuk respons JSON ikut berubah; form di Step 4 menyesuaikan.

**Step 4: `PaymentsSettingsForm.tsx`**

Rename state dan prop secara mekanis (`pakasirEnabled` → `winpayEnabled`, `resellerPakasirEnabled` → `resellerWinpayEnabled`, state setter ikut) lalu ganti dua tile:

```tsx
        <div className="admin-tile border-sky-400/15">
          <div className="admin-tile-header">
            <div className="flex items-center gap-2 min-w-0">
              <CreditCard size={16} className="text-sky-300 shrink-0" />
              <div>
                <p className="admin-tile-title">WinPay (retail)</p>
                <p className="admin-tile-desc">
                  Hanya storefront. OFF menyembunyikan QRIS/VA. Env tetap syarat utama.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={winpayEnabled}
              onClick={toggleWinpay}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${
                winpayEnabled ? "bg-emerald-500/80" : "bg-zinc-600"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  winpayEnabled ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>
        </div>
```

dan:

```tsx
                <p className="admin-tile-title">WinPay (reseller)</p>
                <p className="admin-tile-desc">
                  Portal reseller via QRIS/VA WinPay. Terpisah dari switch retail.
                </p>
```

**Step 5: Halaman settings admin**

```tsx
            <code className="text-text-secondary">WINPAY_ENABLED</code>,{" "}
            <code className="text-text-secondary">WINPAY_KEY</code>,
            dan <code className="text-text-secondary">WINPAY_SECRET_KEY</code>.
```

**Step 6: Verifikasi manual + commit**

```bash
cd apps/web && pnpm typecheck && pnpm lint
git add apps/web/src/lib/payment-settings.ts apps/web/src/app/api/payment/methods/route.ts apps/web/src/app/api/admin/settings/payments/route.ts "apps/web/src/app/(admin)/admin/settings/PaymentsSettingsForm.tsx" "apps/web/src/app/(admin)/admin/settings/page.tsx"
git commit -m "feat(admin): swap Pakasir payment settings for WinPay"
```

Cek manual di `/admin/settings`: 4 switch tampil, toggle WinPay (retail) OFF lalu `GET /api/payment/methods` harus mengembalikan `winpay.enabled: false`.

---

### Task 11: UI storefront

**Files:**
- Modify: `apps/web/src/app/(storefront)/products/[slug]/ProductDetailClient.tsx:60, 90-93, 199, 218, 242, 264, 306-335, 464, 471, 599-602, 755-823, 894, 935, 963`
- Modify: `apps/web/src/app/(storefront)/order/success/PaymentStatusSync.tsx:63, 87-104`

**Step 1: `ProductDetailClient.tsx`**

Semua rename mekanis berikut (gunakan `grep -n` untuk memastikan tidak ada yang tertinggal):

| Sebelum | Sesudah |
|---|---|
| `type PaymentMethod = "crypto" \| "pakasir"` | `type PaymentMethod = "crypto" \| "winpay"` |
| `pakasirEnabled` / `setPakasirEnabled` | `winpayEnabled` / `setWinpayEnabled` |
| `pakasirDisplayPrices` / `setPakasirDisplayPrices` | `idrDisplayPrices` / `setIdrDisplayPrices` |
| `selectedPakasirDisplayPrice` | `selectedIdrDisplayPrice` |
| `paymentMethod: "pakasir"` (event tracking) | `paymentMethod: "winpay"` |
| `paymentMethod=pakasir` (URL) | `paymentMethod=winpay` |
| `data.pakasir?.enabled` | `data.winpay?.enabled` |
| `"Pakasir"` (label tombol) | `"WinPay"` |
| `"QRIS and Indonesian Virtual Accounts"` | `"QRIS, VA bank, dan e-wallet via WinPay"` |
| `"Choose Pakasir or contact sales."` | `"Choose WinPay or contact sales."` |

Dropdown fallback (baris 314–326) menjadi:

```tsx
        setPaymentMethod((current) => {
          if (current === "crypto" && !cryptoAvailable) {
            return winpayAvailable ? "winpay" : null;
          }
          if (current === "winpay" && !winpayAvailable) {
            return cryptoAvailable ? "crypto" : null;
          }
          if (!current) {
            if (cryptoAvailable && !winpayAvailable) return "crypto";
            if (winpayAvailable && !cryptoAvailable) return "winpay";
          }
          return current;
        });
```

dengan `const winpayAvailable = Boolean(data.winpay?.enabled);`.

**Step 2: `PaymentStatusSync.tsx`**

Rename variabel lokal dan panggil route baru:

```ts
    let winpaySyncAttempted = false;
```

```ts
        if (
          orderId &&
          data.paymentProvider === "winpay" &&
          !winpaySyncAttempted &&
          data.status &&
          !SUCCESS_STATUSES.has(data.status)
        ) {
          winpaySyncAttempted = true;
          const syncResponse = await fetch("/api/payment/winpay/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId }),
          });
```

**Step 3: Verifikasi build**

```bash
cd apps/web && pnpm typecheck && pnpm lint
```

Expected: bersih.

**Step 4: Smoke test manual**

Jalankan `pnpm dev` dari root, buka produk apa pun, dan pastikan:

- Kartu pembayaran berlabel **WinPay**.
- Mengganti pilihan memicu `/api/pricing/quote?paymentMethod=winpay` dan harga IDR tampil.
- Klik Checkout (dengan `WINPAY_ENABLED=false`) memunculkan pesan "WinPay is currently unavailable. Please choose Crypto." — bukan 500.

**Step 5: Commit**

```bash
git add "apps/web/src/app/(storefront)/products/[slug]/ProductDetailClient.tsx" "apps/web/src/app/(storefront)/order/success/PaymentStatusSync.tsx"
git commit -m "feat(storefront): offer WinPay instead of Pakasir"
```

---

## FASE 4 — Reseller / B2B

### Task 12: Migrasi enum + layanan B2B

**Files:**
- Modify: `packages/db/prisma/schema.prisma:153-156`
- Create: `packages/db/prisma/migrations/20261113100000_b2b_winpay_payment_method/migration.sql`
- Modify: `apps/web/src/lib/b2b-order-rules.ts:9`
- Modify: `apps/web/src/lib/b2b-order-rules.test.ts:74`
- Modify: `apps/web/src/lib/b2b-order-service.ts:210-216, 314, 341, 360-370, 393`
- Modify: `apps/web/src/lib/reseller-pricing-service.ts:89`
- Modify: `apps/web/src/app/api/reseller/orders/route.ts:29`
- Modify: `apps/web/src/app/api/reseller/catalog/route.ts` (bila menyebut `PAKASIR`)
- Modify: `apps/web/src/app/reseller/ResellerDashboard.tsx:29, 679`
- Modify: `apps/web/src/app/reseller/ResellerOrders.tsx:60, 75, 85-99, 123-125, 161-167`

**Step 1: Schema**

```prisma
enum B2BPaymentMethod {
  CRYPTO
  WINPAY
}
```

**Step 2: Migrasi SQL**

```sql
-- WinPay replaces Pakasir as the Indonesian hosted-checkout provider.
-- RENAME keeps every existing row valid instead of re-adding the value.
ALTER TYPE "B2BPaymentMethod" RENAME VALUE 'PAKASIR' TO 'WINPAY';

UPDATE "B2BPaymentIntent" SET "provider" = 'winpay' WHERE "provider" = 'pakasir';
UPDATE "B2BOrder" SET "paymentProvider" = 'winpay' WHERE "paymentProvider" = 'pakasir';

-- Consumer Pakasir orders older than the drain window can never be confirmed
-- again (the adapter is being removed), so close them out explicitly.
UPDATE "Order"
SET "status" = 'EXPIRED'
WHERE "paymentProvider" = 'pakasir'
  AND "status" = 'PENDING'
  AND "createdAt" < now() - interval '2 hours';
```

**Step 3: Jalankan migrasi di lokal**

```bash
cd /Users/iskavonalia/Documents/kupon/app
pnpm prisma:validate
pnpm db:migrate
pnpm prisma:generate
```

Expected: migrasi `20261113100000_b2b_winpay_payment_method` applied tanpa error.

**Step 4: Rename tipe dan teks**

`b2b-order-rules.ts:9`:

```ts
export type B2BPaymentMethodValue = "CRYPTO" | "WINPAY";
```

`b2b-order-rules.test.ts:74`: ganti `"PAKASIR"` → `"WINPAY"`.

`b2b-order-service.ts`:

```ts
  } else if (!(await isResellerWinpayEnabledForCheckout())) {
    throw new B2BOrderError(
      "Payments are temporarily unavailable. Please contact admin at cs@eztopup.io.",
      503,
      "WINPAY_UNAVAILABLE",
    );
  }
```

```ts
            provider: params.paymentMethod === "CRYPTO" ? "cryptomus" : "winpay",
```

```ts
  let provider: "cryptomus" | "winpay";
```

Cabang pembayaran IDR:

```ts
  } else {
    const invoice = await createWinpayInvoice({
      orderId: order.id,
      productName: `Reseller order ${order.orderNumber}`,
      amountIDR: payload.totalIDR,
      customerName: deliveryEmail.split("@")[0] || "Reseller",
      customerEmail: deliveryEmail,
      customerPhone: "08000000000",
      backUrl: resellerUrl.toString(),
      expiryMinutes: PAYMENT_WINDOW_MINUTES,
    });
    paymentUrl = invoice.redirectUrl;
    providerPaymentId = invoice.id;
    provider = "winpay";
  }
```

Import di kepala file: tambahkan `createWinpayInvoice` pada import `@kupon/payments`, dan ganti `isResellerPakasirEnabledForCheckout` → `isResellerWinpayEnabledForCheckout`.

`applyB2BPaymentEvent`:

```ts
export async function applyB2BPaymentEvent(params: {
  provider: "cryptomus" | "pakasir" | "winpay";
```

(`"pakasir"` dipertahankan agar data historis tetap terbaca selama masa drain.)

`reseller-pricing-service.ts:89`:

```ts
    defaultPaymentMethod: "WINPAY" as const,
```

`api/reseller/orders/route.ts:29`:

```ts
    const paymentMethod = body.paymentMethod === "CRYPTO" || body.paymentMethod === "WINPAY" ? body.paymentMethod : null;
```

**Step 5: UI reseller**

`ResellerDashboard.tsx`:

```tsx
type Catalog = { products: Product[]; quotedAt: string; orderingEnabled?: boolean; defaultPaymentMethod?: "CRYPTO" | "WINPAY" };
```

```tsx
          defaultMethod={catalog?.defaultPaymentMethod ?? "WINPAY"}
```

`ResellerOrders.tsx`:

```tsx
  defaultMethod: "CRYPTO" | "WINPAY";
```

```tsx
  const [winpayAvailable, setWinpayAvailable] = useState(true);
```

```tsx
        const data = (await response.json()) as {
          crypto?: { enabled?: boolean };
          winpay?: { enabled?: boolean };
          reseller?: {
            crypto?: { enabled?: boolean };
            winpay?: { enabled?: boolean };
          };
        };
        setWinpayAvailable(
          typeof data.reseller?.winpay?.enabled === "boolean"
            ? data.reseller.winpay.enabled
            : Boolean(data.winpay?.enabled),
        );
```

```tsx
  async function placeOrder(method: "CRYPTO" | "WINPAY") {
    if (method === "CRYPTO" ? !cryptoAvailable : !winpayAvailable) return;
```

```tsx
  const orderedMethods: ("CRYPTO" | "WINPAY")[] = (
    ["WINPAY", "CRYPTO"] as ("CRYPTO" | "WINPAY")[]
  ).filter((method) => (method === "CRYPTO" ? cryptoAvailable : winpayAvailable));
```

```tsx
        const isDefault = method === (defaultMethod === "CRYPTO" ? "WINPAY" : defaultMethod);
```

Label tampilan untuk metode (`WINPAY` → "WinPay QRIS / VA") menyesuaikan bila ada map label di file itu.

**Step 6: Test + typecheck**

```bash
cd apps/web
node --experimental-strip-types --test src/lib/b2b-order-rules.test.ts
pnpm typecheck
```

Expected: semua test B2B lulus, typecheck bersih.

**Step 7: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20261113100000_b2b_winpay_payment_method apps/web/src/lib/b2b-order-rules.ts apps/web/src/lib/b2b-order-rules.test.ts apps/web/src/lib/b2b-order-service.ts apps/web/src/lib/reseller-pricing-service.ts apps/web/src/app/api/reseller apps/web/src/app/reseller
git commit -m "feat(b2b): replace Pakasir with WinPay for reseller orders"
```

---

### Task 13: Label admin + bot Telegram

**Files:**
- Modify: `apps/web/src/app/(admin)/admin/orders/OrdersTableClient.tsx:60`
- Modify: `apps/web/src/app/(admin)/admin/orders/page.tsx:20`
- Modify: `apps/web/src/app/(admin)/admin/orders/OrdersFilterClient.tsx:97`
- Modify: `apps/web/src/lib/telegram-shop.ts:5, 78, 82-83, 89, 102, 181, 194`

**Step 1: Admin labels**

`OrdersTableClient.tsx` — gunakan helper bersama:

```ts
import { paymentProviderLabel } from "@/lib/payment-provider";
// ganti `if (provider === "pakasir") return "Pakasir";` dengan:
export function providerLabel(provider: string | null) {
  return paymentProviderLabel(provider);
}
```

(sesuaikan nama fungsi lokal yang sudah ada; yang penting: `winpay` → `WinPay`, `pakasir` → `Pakasir` untuk baris lama.)

`OrdersFilterClient.tsx:97`:

```ts
          ["winpay", "WinPay"],
          ["pakasir", "Pakasir (legacy)"],
```

`OrdersTableClient.tsx:60` dan `page.tsx:20` juga perlu menerima `gateway === "winpay"`.

**Step 2: Telegram shop**

```ts
import { isWinpayCheckoutEnabled } from "@kupon/payments";
```

```ts
  if (isWinpayCheckoutEnabled()) rows.unshift([button("QRIS / VA · WinPay", `pay:${state.nonce}:winpay`)]);
```

```ts
async function showQuote(chatId: string, state: ShopState, paymentMethod: "crypto" | "winpay") {
  if (paymentMethod === "winpay" && !isWinpayCheckoutEnabled()) return methods(chatId, state);
```

```ts
    await shopMessage(chatId, "This SKU requires more than 20 units to meet the crypto minimum. Choose WinPay or contact /support.");
```

```ts
Payment: ${paymentMethod === "crypto" ? "Cryptomus (network fees are separate)" : "WinPay QRIS / VA"}
```

```ts
    if (method === "crypto" || method === "winpay") return showQuote(chatId, state, method);
```

```ts
    if (method !== "crypto" && method !== "winpay") throw new Error("Invalid method");
```

**Step 3: Verifikasi**

```bash
cd apps/web && pnpm typecheck && pnpm lint
```

**Step 4: Commit**

```bash
git add "apps/web/src/app/(admin)/admin/orders" apps/web/src/lib/telegram-shop.ts
git commit -m "feat(ops): label WinPay orders and Telegram payment button"
```

---

## FASE 5 — Verifikasi, deploy, dokumentasi

### Task 14: Verifikasi penuh + smoke test sandbox

**Step 1: Semua test otomatis**

```bash
cd /Users/iskavonalia/Documents/kupon/app
pnpm --filter @kupon/payments test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: 4 perintah sukses, `winpay.test.ts` 12 test lulus, `payment-provider.test.ts` 3 lulus, `b2b-order-rules.test.ts` tetap lulus.

**Step 2: Smoke test sandbox (environment preview)**

Set di environment preview (`WINPAY_ENABLED=true`, `WINPAY_BASE_URL=https://sandbox-checkout.winpay.id`, kredensial sandbox), lalu:

1. Buat order retail dengan nominal kecil (misal Rp10.000). Pastikan browser diarahkan ke `https://sandbox-checkout.winpay.id/<token>`.
2. Bayar di sandbox (QRIS sandbox). Tunggu callback masuk.
3. Cek log: `[WinPay Callback]` **tidak** boleh muncul; order harus `PAID` lalu `COMPLETED`.
4. Ulangi skenario callback tanpa pembayaran (invoice belum dibayar). Order harus tetap `PENDING` dan route mengembalikan 503 (bukan menandai lunas).
5. Kirim callback palsu dengan `amount` berbeda ke `/api/payment/winpay/callback`. Harus 409 + `winpay_callback_rejected` di security log, order tidak berubah.
6. Buka `/order/success?orderId=<id>` sebelum bayar: halaman menampilkan "Confirming payment" lalu berubah sendiri setelah pembayaran (jalur `/api/payment/winpay/sync`).
7. Ulangi langkah 1–3 untuk satu order reseller (`/reseller`) dan pastikan `B2BOrder` menjadi `PAID`.

Catat hasil setiap poin (terutama 5 **open questions** di kepala dokumen) di session note.

**Step 3: Commit hasil perbaikan** (bila smoke test menemukan bug)

```bash
git add -A
git commit -m "fix(payments): address WinPay sandbox findings"
```

---

### Task 15: Deploy produksi + dokumentasi

**Step 1: Env produksi**

Tambahkan ke `.env` VPS (`/var/www/eztu/apps/web/.env` atau lokasi `.env` yang dipakai PM2):

```
WINPAY_ENABLED=false
WINPAY_KEY=...
WINPAY_SECRET_KEY=...
```

Deploy dengan gate **mati**:

```bash
cd /var/www/eztu && bash scripts/deploy-vps.sh
```

**Step 2: Verifikasi deploy dengan gate mati**

- `https://eztopup.io` → halaman produk menampilkan WinPay sebagai disabled/absent, Crypto tetap jalan.
- `GET https://eztopup.io/api/payment/methods` → `winpay.enabled: false`.
- `POST /api/payment/winpay/callback` dengan body `{}` → 409 (route hidup, bukan 404).

**Step 3: Nyalakan gate**

```bash
# di VPS
sed -i 's/^WINPAY_ENABLED=.*/WINPAY_ENABLED=true/' apps/web/.env
pm2 restart eztu --update-env
```

**Step 4: Transaksi produksi pertama (nominal terkecil)**

Beli SKU termurah, bayar dengan QRIS, dan verifikasi:

- `pm2 logs eztu --lines 80` tanpa `[WinPay Callback]` error.
- Order `PAID` → `COMPLETED` dan kode terkirim.
- Dashboard WinPay menampilkan invoice dengan status terbayar.

**Step 5: Dokumentasi**

Update `docs/README.md` (tambah plan baru), dan tulis `docs/session-notes/2026-11-13-winpay-replace-pakasir.md` mengikuti `_template.md`:

- Ringkasan perubahan (retail + B2B + Telegram).
- Keputusan: hosted checkout, bukan SNAP; WinPay menggantikan Pakasir.
- Env baru dan siapa yang memegang kredensial.
- Hasil verifikasi (test count, smoke test sandbox, transaksi produksi pertama).
- Status deploy: live/belum + blocker.
- Sisa pekerjaan: Task 16 (hapus Pakasir), tanggal drain, tanggal earliest cleanup.

**Step 6: Commit**

```bash
git add docs
git commit -m "docs: record WinPay migration"
```

---

## FASE 6 — Pembersihan (paling cepat drain + 14 hari)

### Task 16: Hapus Pakasir

**Prasyarat:** `PAKASIR_ENABLED=false` sejak Task 1, dan tidak ada order aktif berprovider `pakasir`.

**Files:**
- Delete: `packages/payments/src/pakasir.ts`, `packages/payments/src/pakasir.test.ts`
- Modify: `packages/payments/src/index.ts` (hapus blok ekspor pakasir; pertahankan `"pakasir"` di `PaymentProvider` bila masih ada data lama yang dibaca)
- Delete: `apps/web/src/lib/pakasir-payment.ts`
- Delete: `apps/web/src/app/api/payment/pakasir/**`
- Delete: `apps/web/src/app/api/payment/b2b/pakasir/**`
- Modify: `apps/web/src/app/(admin)/admin/orders/OrdersFilterClient.tsx` (pertahankan label legacy untuk data historis)
- Modify: `.env` produksi (hapus `PAKASIR_*`)

**Step 1: Cek nol order aktif**

```sql
SELECT count(*) FROM "Order"
WHERE "paymentProvider" = 'pakasir' AND "status" IN ('PENDING', 'PROCESSING');

SELECT count(*) FROM "B2BOrder"
WHERE "paymentProvider" = 'pakasir' AND "status" IN ('DRAFT', 'PAYMENT_PENDING');
```

Expected: `0` dan `0`. Kalau tidak, **jangan** lanjut.

**Step 2: Hapus file & referensi**

```bash
grep -rn "pakasir" apps/web/src packages/payments/src --include=*.ts --include=*.tsx -i
```

Expected setelah pembersihan: hanya tersisa di (a) label legacy admin, (b) label riwayat pembacaan data lama, (c) dokumentasi historis di `docs/`.

**Step 3: Verifikasi**

```bash
pnpm --filter @kupon/payments test
pnpm typecheck && pnpm lint && pnpm build
```

**Step 4: Deploy + commit**

```bash
git add -A
git commit -m "chore(payments): remove the retired Pakasir integration"
bash scripts/deploy-vps.sh
```

**Step 5: Update session note** dengan status "Pakasir sepenuhnya dihapus" beserta tanggalnya.

---

## Checklist akhir (definisi selesai)

- [ ] `winpay.test.ts` + `payment-provider.test.ts` lulus; `pnpm typecheck`, `pnpm lint`, `pnpm build` bersih.
- [ ] Tidak ada string `pakasir` di jalur checkout retail, B2B, Telegram, atau admin settings.
- [ ] `GET /api/payment/methods` mengembalikan `winpay` (retail + reseller).
- [ ] Callback tanpa pembayaran **tidak** pernah menandai order lunas.
- [ ] Callback dengan nominal/ref salah ditolak 409 + security event.
- [ ] Halaman `/order/success` memulihkan status lewat `/api/payment/winpay/sync`.
- [ ] Satu transaksi produksi nyata berhasil dari checkout sampai kode terkirim.
- [ ] Session note + `docs/README.md` diperbarui, termasuk tanggal drain dan jadwal pembersihan.
