const BLOG_MARKET_LANGUAGES: Record<string, string> = {
  SA: "Arabic (Saudi Arabia)",
  AE: "Arabic (United Arab Emirates)",
  RU: "Russian",
  KZ: "Kazakh",
  TR: "Turkish",
  IQ: "Arabic (Iraq)",
  EG: "Arabic (Egypt)",
  PH: "Filipino",
  BR: "Portuguese (Brazil)",
  DE: "German",
  GB: "English (United Kingdom)",
  ID: "Indonesian",
  US: "English (United States)",
  JO: "Arabic (Jordan)",
  KW: "Arabic (Kuwait)",
  QA: "Arabic (Qatar)",
  BH: "Arabic (Bahrain)",
  OM: "Arabic (Oman)",
  BY: "Russian (Belarus)",
  AM: "Armenian",
  UZ: "Uzbek",
  GE: "Georgian",
  MY: "Malay",
  MX: "Spanish (Mexico)",
  TH: "Thai",
  SG: "English (Singapore)",
  VN: "Vietnamese",
  IN: "Hindi",
  JP: "Japanese",
  KR: "Korean",
  GLOBAL: "English",
};

export function getBlogLanguageForCountry(country: string) {
  return BLOG_MARKET_LANGUAGES[country.trim().toUpperCase()] || "English";
}

export function planBlogMarketRotation(
  countries: string[],
  count: number,
  lastCountry = "",
  recentCountry = ""
): { markets: string[]; lastCountry: string } {
  const normalizedCountries = [...new Set(
    countries.map((country) => country.trim().toUpperCase()).filter(Boolean)
  )];
  const safeCount = Math.max(0, Math.floor(count));

  if (normalizedCountries.length === 0 || safeCount === 0) {
    return { markets: [], lastCountry: "" };
  }

  const normalizedLast = lastCountry.trim().toUpperCase();
  const normalizedRecent = recentCountry.trim().toUpperCase();
  const anchor = normalizedCountries.includes(normalizedLast)
    ? normalizedLast
    : normalizedCountries.includes(normalizedRecent)
      ? normalizedRecent
      : "";
  const anchorIndex = anchor ? normalizedCountries.indexOf(anchor) : -1;
  const startIndex = anchorIndex >= 0
    ? (anchorIndex + 1) % normalizedCountries.length
    : 0;
  const markets = Array.from(
    { length: safeCount },
    (_, index) =>
      normalizedCountries[(startIndex + index) % normalizedCountries.length]
  );

  return {
    markets,
    lastCountry: markets.at(-1) || anchor,
  };
}
