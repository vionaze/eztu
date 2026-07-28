import assert from "node:assert/strict";
import test from "node:test";
import {
  formatBlogImagePrompt,
  HERO_IMAGE_PROMPT_SUFFIX,
  THUMBNAIL_IMAGE_PROMPT_SUFFIX,
} from "./blog-image-prompt.ts";

test("places the exact original-language article title in every image prompt", () => {
  const title = "دليل شحن الألعاب في السعودية";
  const prompt = formatBlogImagePrompt({
    value: "A premium mobile gaming scene, no visible text.",
    title,
    fallback: "Fallback scene.",
    suffix: HERO_IMAGE_PROMPT_SUFFIX,
  });

  assert.match(prompt, new RegExp(title));
  assert.match(prompt, /context only; do not render/i);
  assert.ok(prompt.endsWith(HERO_IMAGE_PROMPT_SUFFIX));
});

test("title insertion is idempotent and preserves the requested aspect ratio", () => {
  const title = "Panduan Top Up Game Indonesia";
  const first = formatBlogImagePrompt({
    value: "Editorial gaming scene.",
    title,
    fallback: "Fallback scene.",
    suffix: THUMBNAIL_IMAGE_PROMPT_SUFFIX,
  });
  const second = formatBlogImagePrompt({
    value: first,
    title,
    fallback: "Fallback scene.",
    suffix: THUMBNAIL_IMAGE_PROMPT_SUFFIX,
  });

  assert.equal(second, first);
  assert.equal(second.match(/Article title \(original language/g)?.length, 1);
  assert.ok(second.endsWith(THUMBNAIL_IMAGE_PROMPT_SUFFIX));
});
