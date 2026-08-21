export const DEFAULT_BLOG_AI_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_BLOG_AI_MODEL = "gpt-5.6-terra";
export const DEFAULT_BLOG_AI_COUNTRIES = [
  "BR",
  "DE",
  "GB",
  "ID",
  "MY",
  "MX",
  "PH",
  "SA",
  "SG",
  "TH",
  "US",
  "VN",
] as const;

export const BLOG_AI_MODEL_SUGGESTIONS = [
  {
    value: DEFAULT_BLOG_AI_MODEL,
    label: "Recommended — balance intelligence and cost",
  },
  {
    value: "gpt-5.6-luna",
    label: "Budget — cost-sensitive, high-volume workloads",
  },
  {
    value: "gpt-5.6-sol",
    label: "Premium — highest capability for complex work",
  },
] as const;
