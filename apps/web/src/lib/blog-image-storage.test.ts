import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import {
  BLOG_IMAGE_MAX_UPLOAD_BYTES,
  BlogImageUploadError,
  resolveBlogImagePath,
  storeBlogImage,
} from "./blog-image-storage.ts";

async function withStorage(
  run: (storageRoot: string) => Promise<void>
): Promise<void> {
  const storageRoot = await mkdtemp(join(tmpdir(), "eztopup-blog-images-"));
  try {
    await run(storageRoot);
  } finally {
    await rm(storageRoot, { recursive: true, force: true });
  }
}

test("converts PNG hero to a bounded WebP and stores no original", async () => {
  await withStorage(async (storageRoot) => {
    const input = await sharp({
      create: {
        width: 2_400,
        height: 1_350,
        channels: 4,
        background: { r: 36, g: 24, b: 80, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const result = await storeBlogImage({
      bytes: input,
      contentType: "image/png",
      kind: "hero",
      originalName: "campaign-hero.png",
      storageRoot,
      now: new Date("2026-07-28T12:00:00.000Z"),
    });

    assert.match(
      result.path,
      /^\/media\/blog\/hero\/2026\/07\/[0-9a-f-]{36}\.webp$/
    );
    assert.equal(result.format, "webp");
    assert.equal(result.width, 1_920);
    assert.equal(result.height, 1_080);

    const stored = await readFile(result.filePath);
    const metadata = await sharp(stored).metadata();
    assert.equal(metadata.format, "webp");

    const files = await readdir(join(storageRoot, "hero", "2026", "07"));
    assert.deepEqual(files, [result.fileName]);
    assert.equal(files.some((file) => /\.(png|jpe?g)$/i.test(file)), false);
  });
});

test("converts JPEG thumbnail without enlarging it", async () => {
  await withStorage(async (storageRoot) => {
    const input = await sharp({
      create: {
        width: 640,
        height: 480,
        channels: 3,
        background: { r: 240, g: 160, b: 40 },
      },
    })
      .jpeg()
      .toBuffer();

    const result = await storeBlogImage({
      bytes: input,
      contentType: "image/jpeg",
      kind: "thumbnail",
      originalName: "card.jpeg",
      storageRoot,
    });

    assert.equal(result.width, 640);
    assert.equal(result.height, 480);
    assert.match(result.path, /^\/media\/blog\/thumbnail\//);
  });
});

test("rejects unsupported decoded formats and oversized uploads", async () => {
  await withStorage(async (storageRoot) => {
    const gif = await sharp({
      create: {
        width: 20,
        height: 20,
        channels: 3,
        background: "red",
      },
    })
      .gif()
      .toBuffer();

    await assert.rejects(
      storeBlogImage({
        bytes: gif,
        contentType: "image/png",
        kind: "hero",
        originalName: "fake.png",
        storageRoot,
      }),
      (error: unknown) =>
        error instanceof BlogImageUploadError &&
        error.code === "UNSUPPORTED_IMAGE"
    );

    await assert.rejects(
      storeBlogImage({
        bytes: Buffer.alloc(BLOG_IMAGE_MAX_UPLOAD_BYTES + 1),
        contentType: "image/png",
        kind: "hero",
        originalName: "huge.png",
        storageRoot,
      }),
      (error: unknown) =>
        error instanceof BlogImageUploadError &&
        error.code === "FILE_TOO_LARGE"
    );
  });
});

test("resolves only generated WebP media paths beneath the storage root", () => {
  const storageRoot = "/tmp/eztopup-safe-storage";
  const safe = resolveBlogImagePath(
    ["hero", "2026", "07", "d9428888-122b-11e1-b85c-61cd3cbb3210.webp"],
    storageRoot
  );

  assert.equal(
    safe,
    join(
      storageRoot,
      "hero",
      "2026",
      "07",
      "d9428888-122b-11e1-b85c-61cd3cbb3210.webp"
    )
  );

  assert.throws(
    () =>
      resolveBlogImagePath(
        ["hero", "..", "..", "secrets.webp"],
        storageRoot
      ),
    BlogImageUploadError
  );
  assert.throws(
    () =>
      resolveBlogImagePath(
        ["hero", "2026", "07", "not-an-upload.png"],
        storageRoot
      ),
    BlogImageUploadError
  );
});
