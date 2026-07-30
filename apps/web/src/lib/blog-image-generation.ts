import "server-only";
import { unlink } from "node:fs/promises";
import { prisma } from "@kupon/db";
import { writeAppLog } from "@/lib/app-log";
import {
  BLOG_IMAGE_MAX_UPLOAD_BYTES,
  type BlogImageKind,
  storeBlogImage,
} from "@/lib/blog-image-storage";
import {
  createKieZImageTask,
  downloadKieGeneratedImage,
  getKieTaskRecord,
  KIE_Z_IMAGE_MODEL,
  type KieZImageAspectRatio,
} from "@/lib/kie-image";

const ACTIVE_STATUSES = [
  "SUBMITTING",
  "PROCESSING",
  "DOWNLOADING",
] as const;
const KINDS = ["hero", "thumbnail"] as const satisfies readonly BlogImageKind[];

const KIND_CONFIG: Record<
  BlogImageKind,
  {
    promptField: "heroImagePrompt" | "thumbnailImagePrompt";
    imageField: "coverImage" | "thumbnailImage";
    aspectRatio: KieZImageAspectRatio;
  }
> = {
  hero: {
    promptField: "heroImagePrompt",
    imageField: "coverImage",
    aspectRatio: "16:9",
  },
  thumbnail: {
    promptField: "thumbnailImagePrompt",
    imageField: "thumbnailImage",
    aspectRatio: "4:3",
  },
};

export type BlogImageGenerationView = {
  id: string;
  kind: BlogImageKind;
  status: "SUBMITTING" | "PROCESSING" | "DOWNLOADING" | "SUCCEEDED" | "FAILED";
  error: string | null;
  storedImagePath: string | null;
  updatedAt: string;
};

function truthy(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "yes";
}

export function isKieBlogImageGenerationEnabled(): boolean {
  return (
    truthy(process.env.KIE_IMAGE_GENERATION_ENABLED?.trim().toLowerCase()) &&
    Boolean(process.env.KIE_API_KEY?.trim())
  );
}

function getKieCallbackUrl(): string | null {
  const explicit = process.env.KIE_CALLBACK_URL?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const candidate = explicit || appUrl;
  if (!candidate) return null;

  try {
    const url = explicit
      ? new URL(explicit)
      : new URL("/api/webhooks/kie/blog-images", appUrl);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : "Image generation failed.")
    .trim()
    .slice(0, 1000);
}

function toView(generation: {
  id: string;
  kind: string;
  status: string;
  error: string | null;
  storedImagePath: string | null;
  updatedAt: Date;
}): BlogImageGenerationView {
  return {
    id: generation.id,
    kind: generation.kind as BlogImageKind,
    status: generation.status as BlogImageGenerationView["status"],
    error: generation.error,
    storedImagePath: generation.storedImagePath,
    updatedAt: generation.updatedAt.toISOString(),
  };
}

async function startKind(input: {
  postId: string;
  kind: BlogImageKind;
  prompt: string;
  force: boolean;
  actor: string;
}): Promise<BlogImageGenerationView | null> {
  const config = KIND_CONFIG[input.kind];
  const existingActive = await prisma.blogImageGeneration.findFirst({
    where: {
      postId: input.postId,
      kind: input.kind,
      status: { in: [...ACTIVE_STATUSES] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existingActive && !input.force) return toView(existingActive);

  if (existingActive) {
    await prisma.blogImageGeneration.updateMany({
      where: {
        postId: input.postId,
        kind: input.kind,
        status: { in: [...ACTIVE_STATUSES] },
      },
      data: {
        status: "FAILED",
        error: "Superseded by a newer generation request.",
        completedAt: new Date(),
      },
    });
  }

  const generation = await prisma.blogImageGeneration.create({
    data: {
      postId: input.postId,
      kind: input.kind,
      model: KIE_Z_IMAGE_MODEL,
      prompt: input.prompt,
      aspectRatio: config.aspectRatio,
      status: "SUBMITTING",
    },
  });

  try {
    const taskId = await createKieZImageTask({
      prompt: input.prompt,
      aspectRatio: config.aspectRatio,
      callbackUrl: getKieCallbackUrl(),
    });
    const updated = await prisma.blogImageGeneration.update({
      where: { id: generation.id },
      data: {
        taskId,
        status: "PROCESSING",
        error: null,
      },
    });
    await writeAppLog({
      category: "BLOG",
      level: "INFO",
      title: `KIE ${input.kind} image started`,
      actor: input.actor,
      route: "/lib/blog-image-generation",
      metadata: {
        postId: input.postId,
        generationId: generation.id,
        kind: input.kind,
        aspectRatio: config.aspectRatio,
        provider: "kie",
        model: KIE_Z_IMAGE_MODEL,
      },
    });
    return toView(updated);
  } catch (error) {
    const message = errorMessage(error);
    const failed = await prisma.blogImageGeneration.update({
      where: { id: generation.id },
      data: {
        status: "FAILED",
        error: message,
        completedAt: new Date(),
      },
    });
    await writeAppLog({
      category: "BLOG",
      level: "ERROR",
      title: `KIE ${input.kind} image failed to start`,
      message,
      actor: input.actor,
      route: "/lib/blog-image-generation",
      metadata: {
        postId: input.postId,
        generationId: generation.id,
        kind: input.kind,
      },
    });
    return toView(failed);
  }
}

export async function startBlogImageGenerations(input: {
  postId: string;
  heroPrompt?: string | null;
  thumbnailPrompt?: string | null;
  force?: boolean;
  actor?: string;
}): Promise<BlogImageGenerationView[]> {
  if (!isKieBlogImageGenerationEnabled()) {
    throw new Error(
      "KIE image generation is disabled or KIE_API_KEY is not configured."
    );
  }

  const promptUpdate: {
    heroImagePrompt?: string;
    thumbnailImagePrompt?: string;
  } = {};
  if (input.heroPrompt !== undefined) {
    promptUpdate.heroImagePrompt = input.heroPrompt?.trim().slice(0, 5000) || "";
  }
  if (input.thumbnailPrompt !== undefined) {
    promptUpdate.thumbnailImagePrompt =
      input.thumbnailPrompt?.trim().slice(0, 5000) || "";
  }

  const post =
    Object.keys(promptUpdate).length > 0
      ? await prisma.blogPost.update({
          where: { id: input.postId },
          data: promptUpdate,
        })
      : await prisma.blogPost.findUnique({ where: { id: input.postId } });
  if (!post) throw new Error("Blog post not found.");

  const targets = KINDS.filter((kind) => {
    if (input.force) return true;
    return !post[KIND_CONFIG[kind].imageField]?.trim();
  });
  const prompts = targets.map((kind) => ({
    kind,
    prompt: post[KIND_CONFIG[kind].promptField]?.trim() || "",
  }));
  const missing = prompts.find((item) => !item.prompt);
  if (missing) {
    throw new Error(
      `${missing.kind === "hero" ? "Hero" : "Thumbnail"} image prompt is required.`
    );
  }

  const results = await Promise.all(
    prompts.map((item) =>
      startKind({
        postId: post.id,
        kind: item.kind,
        prompt: item.prompt,
        force: Boolean(input.force),
        actor: input.actor || "blog-image-generator",
      })
    )
  );
  return results.filter(
    (result): result is BlogImageGenerationView => result !== null
  );
}

async function markFailed(id: string, error: unknown) {
  return prisma.blogImageGeneration.update({
    where: { id },
    data: {
      status: "FAILED",
      error: errorMessage(error),
      completedAt: new Date(),
    },
  });
}

export async function reconcileBlogImageGeneration(
  generationId: string
): Promise<BlogImageGenerationView> {
  let generation = await prisma.blogImageGeneration.findUnique({
    where: { id: generationId },
  });
  if (!generation) throw new Error("Blog image generation was not found.");
  if (generation.status === "SUCCEEDED" || generation.status === "FAILED") {
    return toView(generation);
  }

  if (generation.status === "DOWNLOADING") {
    const staleBefore = Date.now() - 5 * 60 * 1000;
    if (generation.updatedAt.getTime() >= staleBefore) return toView(generation);
    generation = await prisma.blogImageGeneration.update({
      where: { id: generation.id },
      data: { status: "PROCESSING" },
    });
  }

  if (!generation.taskId) {
    if (Date.now() - generation.createdAt.getTime() < 2 * 60 * 1000) {
      return toView(generation);
    }
    return toView(
      await markFailed(generation.id, "KIE task creation did not complete.")
    );
  }

  let task;
  try {
    task = await getKieTaskRecord(generation.taskId);
  } catch (error) {
    // A temporary provider lookup failure must not consume the only retry.
    await prisma.blogImageGeneration.update({
      where: { id: generation.id },
      data: { error: errorMessage(error) },
    });
    return toView(
      (await prisma.blogImageGeneration.findUnique({
        where: { id: generation.id },
      }))!
    );
  }

  if (task.taskId !== generation.taskId) {
    return toView(
      await markFailed(generation.id, "KIE returned a mismatched task ID.")
    );
  }
  if (task.state === "fail") {
    return toView(
      await markFailed(generation.id, task.error || "KIE image generation failed.")
    );
  }
  if (task.state !== "success") {
    const updated = await prisma.blogImageGeneration.update({
      where: { id: generation.id },
      data: { status: "PROCESSING", error: null },
    });
    return toView(updated);
  }
  if (!task.resultUrl) {
    return toView(
      await markFailed(generation.id, "KIE completed without an image URL.")
    );
  }

  const claimed = await prisma.blogImageGeneration.updateMany({
    where: {
      id: generation.id,
      status: { in: ["SUBMITTING", "PROCESSING"] },
    },
    data: { status: "DOWNLOADING", error: null },
  });
  if (claimed.count !== 1) {
    return toView(
      (await prisma.blogImageGeneration.findUnique({
        where: { id: generation.id },
      }))!
    );
  }

  let stored: Awaited<ReturnType<typeof storeBlogImage>> | null = null;
  try {
    const downloaded = await downloadKieGeneratedImage({
      url: task.resultUrl,
      maxBytes: BLOG_IMAGE_MAX_UPLOAD_BYTES,
    });
    stored = await storeBlogImage({
      bytes: downloaded.bytes,
      contentType: downloaded.contentType,
      kind: generation.kind as BlogImageKind,
      originalName: `${generation.taskId}.${downloaded.contentType.split("/")[1]}`,
      allowGeneratedWebp: true,
    });

    await prisma.$transaction(async (tx) => {
      const latest = await tx.blogImageGeneration.findFirst({
        where: { postId: generation!.postId, kind: generation!.kind },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (latest?.id !== generation!.id) {
        throw new Error("Superseded by a newer generation request.");
      }

      const imageField =
        KIND_CONFIG[generation!.kind as BlogImageKind].imageField;
      await tx.blogPost.update({
        where: { id: generation!.postId },
        data: { [imageField]: stored!.path },
      });
      await tx.blogImageGeneration.update({
        where: { id: generation!.id },
        data: {
          status: "SUCCEEDED",
          storedImagePath: stored!.path,
          error: null,
          completedAt: new Date(),
        },
      });
    });

    await writeAppLog({
      category: "BLOG",
      level: "SUCCESS",
      title: `KIE ${generation.kind} image saved`,
      actor: "webhook:kie",
      route: "/lib/blog-image-generation",
      metadata: {
        postId: generation.postId,
        generationId: generation.id,
        kind: generation.kind,
        path: stored.path,
        width: stored.width,
        height: stored.height,
        bytes: stored.bytes,
      },
    });
  } catch (error) {
    if (stored) await unlink(stored.filePath).catch(() => undefined);
    await markFailed(generation.id, error);
    await writeAppLog({
      category: "BLOG",
      level: "ERROR",
      title: `KIE ${generation.kind} image could not be saved`,
      message: errorMessage(error),
      actor: "webhook:kie",
      route: "/lib/blog-image-generation",
      metadata: {
        postId: generation.postId,
        generationId: generation.id,
        kind: generation.kind,
      },
    });
  }

  return toView(
    (await prisma.blogImageGeneration.findUnique({
      where: { id: generation.id },
    }))!
  );
}

export async function reconcileBlogImageGenerationByTaskId(
  taskId: string
): Promise<BlogImageGenerationView | null> {
  const generation = await prisma.blogImageGeneration.findUnique({
    where: { taskId },
  });
  return generation
    ? reconcileBlogImageGeneration(generation.id)
    : null;
}

export async function getLatestBlogImageGenerations(
  postId: string
): Promise<BlogImageGenerationView[]> {
  const rows = await prisma.blogImageGeneration.findMany({
    where: { postId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const seen = new Set<string>();
  return rows
    .filter((row) => {
      if (!KINDS.includes(row.kind as BlogImageKind) || seen.has(row.kind)) {
        return false;
      }
      seen.add(row.kind);
      return true;
    })
    .map(toView);
}

export async function reconcileLatestBlogImageGenerations(
  postId: string
): Promise<BlogImageGenerationView[]> {
  const latest = await getLatestBlogImageGenerations(postId);
  await Promise.all(
    latest
      .filter((item) =>
        ["SUBMITTING", "PROCESSING", "DOWNLOADING"].includes(item.status)
      )
      .map((item) => reconcileBlogImageGeneration(item.id))
  );
  return getLatestBlogImageGenerations(postId);
}

export async function reconcilePendingBlogImageGenerations(
  limit = 20
): Promise<void> {
  if (!isKieBlogImageGenerationEnabled()) return;
  const pending = await prisma.blogImageGeneration.findMany({
    where: { status: { in: [...ACTIVE_STATUSES] } },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(limit, 50)),
    select: { id: true },
  });
  await Promise.allSettled(
    pending.map((generation) =>
      reconcileBlogImageGeneration(generation.id)
    )
  );
}
