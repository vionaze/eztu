export const HERO_IMAGE_PROMPT_SUFFIX =
  "Aspect ratio: 16:9. Recommended GPT Image size: 2048x1152. --ar 16:9";
export const THUMBNAIL_IMAGE_PROMPT_SUFFIX =
  "Aspect ratio: 4:3. Recommended GPT Image size: 1536x1152. --ar 4:3";

const TITLE_CONTEXT_PATTERN =
  /^Article title \(original language; context only; do not render this title or any words in the image\): "[\s\S]*?"\.\s*/i;

function sanitizePromptText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, maxLength);
}

export function formatBlogImagePrompt(params: {
  value: unknown;
  title: string;
  fallback: string;
  suffix: string;
}) {
  const title = sanitizePromptText(params.title, 200)
    .replace(/\s+/g, " ")
    .replace(/"/g, "'");
  const cleaned = sanitizePromptText(params.value, 4_300)
    .replace(TITLE_CONTEXT_PATTERN, "")
    .replace(/\s*Aspect ratio:[\s\S]*$/i, "")
    .trim();
  const fallback = sanitizePromptText(params.fallback, 4_300);
  const titleContext =
    `Article title (original language; context only; do not render this title or any words in the image): "${title}".`;

  return `${titleContext}\n\n${cleaned || fallback}\n\n${params.suffix}`.slice(
    0,
    5_000
  );
}

export function formatExistingBlogImagePrompt(
  value: string | null | undefined,
  title: string,
  kind: "hero" | "thumbnail"
) {
  if (!value?.trim()) return "";
  const suffix =
    kind === "hero"
      ? HERO_IMAGE_PROMPT_SUFFIX
      : THUMBNAIL_IMAGE_PROMPT_SUFFIX;
  return formatBlogImagePrompt({
    value,
    title,
    fallback: value,
    suffix,
  });
}
