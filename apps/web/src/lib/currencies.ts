export type CountryCode =
  | "BR"
  | "DE"
  | "GB"
  | "ID"
  | "MY"
  | "MX"
  | "PH"
  | "SA"
  | "SG"
  | "TH"
  | "US"
  | "VN";

export interface Country {
  code: CountryCode;
  supplierCode: string;
  name: string;
  currency: string;
  symbol: string;
  /** Display fallback only. Checkout uses the signed server-side IDR/USD quote. */
  rateToUSD: number;
  flag: string;
}

export const COUNTRIES: Country[] = [
  { code: "ID", supplierCode: "id", name: "Indonesia", currency: "IDR", symbol: "Rp", rateToUSD: 16_000, flag: "🇮🇩" },
  { code: "SG", supplierCode: "sg", name: "Singapore", currency: "SGD", symbol: "S$", rateToUSD: 1.35, flag: "🇸🇬" },
  { code: "MY", supplierCode: "my", name: "Malaysia", currency: "MYR", symbol: "RM", rateToUSD: 4.45, flag: "🇲🇾" },
  { code: "MX", supplierCode: "mx", name: "Mexico", currency: "MXN", symbol: "MX$", rateToUSD: 17, flag: "🇲🇽" },
  { code: "PH", supplierCode: "ph", name: "Philippines", currency: "PHP", symbol: "₱", rateToUSD: 58, flag: "🇵🇭" },
  { code: "TH", supplierCode: "th", name: "Thailand", currency: "THB", symbol: "฿", rateToUSD: 35, flag: "🇹🇭" },
  { code: "BR", supplierCode: "br", name: "Brazil", currency: "BRL", symbol: "R$", rateToUSD: 5.4, flag: "🇧🇷" },
  { code: "US", supplierCode: "us", name: "United States", currency: "USD", symbol: "$", rateToUSD: 1, flag: "🇺🇸" },
  { code: "DE", supplierCode: "de", name: "Germany", currency: "EUR", symbol: "€", rateToUSD: 0.92, flag: "🇩🇪" },
  { code: "GB", supplierCode: "gb", name: "United Kingdom", currency: "GBP", symbol: "£", rateToUSD: 0.79, flag: "🇬🇧" },
  { code: "VN", supplierCode: "vn", name: "Vietnam", currency: "VND", symbol: "₫", rateToUSD: 25_500, flag: "🇻🇳" },
  { code: "SA", supplierCode: "sa", name: "Saudi Arabia", currency: "SAR", symbol: "ر.س", rateToUSD: 3.75, flag: "🇸🇦" },
];

export const DEFAULT_COUNTRY = COUNTRIES.find((country) => country.code === "ID")!;

export function findCountryBySupplierCode(code: string | null | undefined) {
  const normalized = code?.trim().toLowerCase();
  return COUNTRIES.find((country) => country.supplierCode === normalized) || null;
}

export function findCountryByRegion(code: string | null | undefined) {
  const normalized = code?.trim().toUpperCase();
  return COUNTRIES.find((country) => country.code === normalized) || null;
}
