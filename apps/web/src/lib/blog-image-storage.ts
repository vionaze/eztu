import { randomUUID } from "node:crypto";
import {
  mkdir,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import sharp from "sharp";

type SharpMetadata = Awaited<
  ReturnType<ReturnType<typeof sharp>["metadata"]>
>;
type ConvertedImage = {
  data: Buffer;
  info: { width: number; height: number; size: number };
};

export type BlogImageKind = "hero" | "thumbnail";

export const BLOG_IMAGE_MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
export const BLOG_IMAGE_ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
] as const;

const MAX_INPUT_PIXELS = 40_000_000;
const GENERATED_FILE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i;

const OUTPUT_LIMITS: Record<
  BlogImageKind,
  { width: number; height: number; quality: number }
> = {
  hero: { width: 1_920, height: 1_080, quality: 84 },
  thumbnail: { width: 960, height: 960, quality: 82 },
};

export type BlogImageUploadErrorCode =
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "INVALID_KIND"
  | "INVALID_MEDIA_PATH"
  | "UNSUPPORTED_IMAGE";

export class BlogImageUploadError extends Error {
  readonly code: BlogImageUploadErrorCode;
  readonly status: number;

  constructor(
    code: BlogImageUploadErrorCode,
    message: string,
    status = 400
  ) {
    super(message);
    this.name = "BlogImageUploadError";
    this.code = code;
    this.status = status;
  }
}

export function isBlogImageKind(value: unknown): value is BlogImageKind {
  return value === "hero" || value === "thumbnail";
}

export function getBlogImageStorageRoot() {
  const configured = process.env.BLOG_UPLOAD_DIR?.trim();
  return resolve(configured || join(process.cwd(), ".data", "blog-images"));
}

export function resolveBlogImagePath(
  segments: string[],
  storageRoot = getBlogImageStorageRoot()
) {
  if (
    segments.length !== 4 ||
    !isBlogImageKind(segments[0]) ||
    !/^\d{4}$/.test(segments[1]) ||
    !/^(0[1-9]|1[0-2])$/.test(segments[2]) ||
    !GENERATED_FILE_PATTERN.test(segments[3])
  ) {
    throw new BlogImageUploadError(
      "INVALID_MEDIA_PATH",
      "Invalid blog image path.",
      404
    );
  }

  const root = resolve(storageRoot);
  const filePath = resolve(root, ...segments);
  const relativePath = relative(root, filePath);

  if (
    !relativePath ||
    relativePath.startsWith("..") ||
    isAbsolute(relativePath)
  ) {
    throw new BlogImageUploadError(
      "INVALID_MEDIA_PATH",
      "Invalid blog image path.",
      404
    );
  }

  return filePath;
}

type StoreBlogImageInput = {
  bytes: Buffer;
  contentType: string;
  kind: BlogImageKind;
  originalName?: string;
  /** Provider results may already be WebP; admin uploads intentionally may not. */
  allowGeneratedWebp?: boolean;
  storageRoot?: string;
  now?: Date;
};

export type StoredBlogImage = {
  path: string;
  filePath: string;
  fileName: string;
  format: "webp";
  width: number;
  height: number;
  bytes: number;
  sourceBytes: number;
};

export async function storeBlogImage(
  input: StoreBlogImageInput
): Promise<StoredBlogImage> {
  if (!isBlogImageKind(input.kind)) {
    throw new BlogImageUploadError(
      "INVALID_KIND",
      "Image kind must be hero or thumbnail."
    );
  }
  if (input.bytes.length === 0) {
    throw new BlogImageUploadError("EMPTY_FILE", "Choose an image to upload.");
  }
  if (input.bytes.length > BLOG_IMAGE_MAX_UPLOAD_BYTES) {
    throw new BlogImageUploadError(
      "FILE_TOO_LARGE",
      "Image is larger than the 12 MB upload limit.",
      413
    );
  }
  const isGeneratedWebp =
    input.allowGeneratedWebp && input.contentType === "image/webp";
  if (
    !isGeneratedWebp &&
    !BLOG_IMAGE_ALLOWED_CONTENT_TYPES.includes(
      input.contentType as (typeof BLOG_IMAGE_ALLOWED_CONTENT_TYPES)[number]
    )
  ) {
    throw new BlogImageUploadError(
      "UNSUPPORTED_IMAGE",
      "Only JPG, JPEG, and PNG images are supported."
    );
  }

  let metadata: SharpMetadata;
  try {
    metadata = await sharp(input.bytes, {
      failOn: "error",
      limitInputPixels: MAX_INPUT_PIXELS,
    }).metadata();
  } catch {
    throw new BlogImageUploadError(
      "UNSUPPORTED_IMAGE",
      "The uploaded file is not a valid JPG or PNG image."
    );
  }

  if (
    (metadata.format !== "jpeg" &&
      metadata.format !== "png" &&
      !(isGeneratedWebp && metadata.format === "webp")) ||
    !metadata.width ||
    !metadata.height
  ) {
    throw new BlogImageUploadError(
      "UNSUPPORTED_IMAGE",
      "The uploaded file is not a valid JPG or PNG image."
    );
  }

  const limit = OUTPUT_LIMITS[input.kind];
  let converted: ConvertedImage;
  try {
    converted = await sharp(input.bytes, {
      failOn: "error",
      limitInputPixels: MAX_INPUT_PIXELS,
    })
      .rotate()
      .resize({
        width: limit.width,
        height: limit.height,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality: limit.quality,
        effort: 4,
        smartSubsample: true,
      })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new BlogImageUploadError(
      "UNSUPPORTED_IMAGE",
      "The uploaded image could not be converted."
    );
  }

  const now = input.now ?? new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const fileName = `${randomUUID()}.webp`;
  const segments = [input.kind, year, month, fileName];
  const storageRoot = resolve(input.storageRoot || getBlogImageStorageRoot());
  const filePath = resolveBlogImagePath(segments, storageRoot);
  const directory = join(storageRoot, input.kind, year, month);
  const temporaryPath = join(directory, `.${randomUUID()}.tmp`);

  await mkdir(directory, { recursive: true });
  try {
    await writeFile(temporaryPath, converted.data, {
      flag: "wx",
      mode: 0o644,
    });
    await rename(temporaryPath, filePath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }

  return {
    path: `/media/blog/${segments.join("/")}`,
    filePath,
    fileName,
    format: "webp",
    width: converted.info.width,
    height: converted.info.height,
    bytes: converted.info.size,
    sourceBytes: input.bytes.length,
  };
}
