export type CountryCode = "ID" | "US" | "MY" | "PH" | "SG" | "TH" | "EU";

export interface Country {
  code: CountryCode;
  name: string;
  currency: string;
  symbol: string;
  rateToUSD: number; // 1 USD = X Currency
  flag: string; // Emoji flag
}

export const COUNTRIES: Country[] = [
  {
    code: "ID",
    name: "Indonesia",
    currency: "IDR",
    symbol: "Rp",
    rateToUSD: 16000, // Not strictly used for displaying prices if we use db priceIDR directly, but good for reference
    flag: "🇮🇩",
  },
  {
    code: "US",
    name: "United States",
    currency: "USD",
    symbol: "$",
    rateToUSD: 1,
    flag: "🇺🇸",
  },
  {
    code: "MY",
    name: "Malaysia",
    currency: "MYR",
    symbol: "RM",
    rateToUSD: 4.75,
    flag: "🇲🇾",
  },
  {
    code: "PH",
    name: "Philippines",
    currency: "PHP",
    symbol: "₱",
    rateToUSD: 58.5,
    flag: "🇵🇭",
  },
  {
    code: "SG",
    name: "Singapore",
    currency: "SGD",
    symbol: "S$",
    rateToUSD: 1.35,
    flag: "🇸🇬",
  },
  {
    code: "TH",
    name: "Thailand",
    currency: "THB",
    symbol: "฿",
    rateToUSD: 36.8,
    flag: "🇹🇭",
  },
  {
    code: "EU",
    name: "Europe",
    currency: "EUR",
    symbol: "€",
    rateToUSD: 0.93,
    flag: "🇪🇺",
  },
];

export const DEFAULT_COUNTRY = COUNTRIES[0]; // Indonesia
