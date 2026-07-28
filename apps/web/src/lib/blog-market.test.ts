import assert from "node:assert/strict";
import test from "node:test";
import {
  getBlogLanguageForCountry,
  planBlogMarketRotation,
} from "./blog-market.ts";

test("maps every configured blog market to its intended article language", () => {
  const expected: Record<string, string> = {
    SA: "Arabic (Saudi Arabia)",
    AE: "Arabic (United Arab Emirates)",
    RU: "Russian",
    KZ: "Kazakh",
    TR: "Turkish",
    IQ: "Arabic (Iraq)",
    EG: "Arabic (Egypt)",
    PH: "Filipino",
    BR: "Portuguese (Brazil)",
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
    TH: "Thai",
    SG: "English (Singapore)",
    VN: "Vietnamese",
    IN: "Hindi",
    JP: "Japanese",
    KR: "Korean",
    GLOBAL: "English",
  };

  for (const [country, language] of Object.entries(expected)) {
    assert.equal(getBlogLanguageForCountry(country), language, country);
  }
});

test("falls back to English only for unknown markets", () => {
  assert.equal(getBlogLanguageForCountry("XX"), "English");
});

test("continues after the last market across one-article runs", () => {
  const countries = ["SA", "AE", "RU", "KZ"];

  assert.deepEqual(planBlogMarketRotation(countries, 1, "SA"), {
    markets: ["AE"],
    lastCountry: "AE",
  });
  assert.deepEqual(planBlogMarketRotation(countries, 1, "KZ"), {
    markets: ["SA"],
    lastCountry: "SA",
  });
});

test("uses the most recent AI market when no persisted cursor exists", () => {
  assert.deepEqual(
    planBlogMarketRotation(["SA", "AE", "RU"], 2, "", "SA"),
    {
      markets: ["AE", "RU"],
      lastCountry: "RU",
    }
  );
});

test("starts at the first market when neither cursor nor history matches", () => {
  assert.deepEqual(
    planBlogMarketRotation(["SA", "AE", "RU"], 2, "DE", "FR"),
    {
      markets: ["SA", "AE"],
      lastCountry: "AE",
    }
  );
});
