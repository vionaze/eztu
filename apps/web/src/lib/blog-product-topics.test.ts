import assert from "node:assert/strict";
import test from "node:test";
import {
  INDONESIAN_PRODUCT_BLOG_TOPICS,
  buildIndonesianProductTopic,
} from "./blog-product-topics.ts";

test("covers the nine requested product families in Indonesian", () => {
  assert.equal(INDONESIAN_PRODUCT_BLOG_TOPICS.length, 9);
  for (const product of [
    "Mobile Legends",
    "Honor of Kings",
    "Call of Duty Mobile",
    "Steam",
    "Free Fire",
    "Valorant",
    "Nintendo",
    "PlayStation",
    "Xbox",
  ]) {
    assert.equal(
      INDONESIAN_PRODUCT_BLOG_TOPICS.some((topic) => topic.includes(product)),
      true,
    );
  }
});

test("rotates away from a recently used product topic", () => {
  const first = buildIndonesianProductTopic([]);
  const second = buildIndonesianProductTopic([first]);
  assert.notEqual(first, second);
});
