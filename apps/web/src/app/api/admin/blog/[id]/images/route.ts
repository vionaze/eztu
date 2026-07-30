import { NextResponse } from "next/server";
import { prisma } from "@kupon/db";
import { requireAdminUser } from "@/lib/clerk";
import {
  getLatestBlogImageGenerations,
  reconcileLatestBlogImageGenerations,
  startBlogImageGenerations,
} from "@/lib/blog-image-generation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

async function getImageState(postId: string, reconcile: boolean) {
  const generations = reconcile
    ? await reconcileLatestBlogImageGenerations(postId)
    : await getLatestBlogImageGenerations(postId);
  const post = await prisma.blogPost.findUnique({
    where: { id: postId },
    select: { coverImage: true, thumbnailImage: true },
  });
  return {
    generations,
    images: {
      hero: post?.coverImage || null,
      thumbnail: post?.thumbnailImage || null,
    },
  };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireAdminUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const exists = await prisma.blogPost.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json({ error: "Blog post not found." }, { status: 404 });
    }
    return NextResponse.json(await getImageState(id, true));
  } catch (error) {
    console.error("[admin/blog/images GET]", error);
    return NextResponse.json(
      { error: "Image generation status could not be refreshed." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  let admin: Awaited<ReturnType<typeof requireAdminUser>>;
  try {
    admin = await requireAdminUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      heroPrompt?: unknown;
      thumbnailPrompt?: unknown;
      force?: unknown;
    };

    await startBlogImageGenerations({
      postId: id,
      heroPrompt:
        body.heroPrompt === undefined ? undefined : String(body.heroPrompt),
      thumbnailPrompt:
        body.thumbnailPrompt === undefined
          ? undefined
          : String(body.thumbnailPrompt),
      force: Boolean(body.force),
      actor: admin.email || admin.dbUserId,
    });

    return NextResponse.json(await getImageState(id, false), { status: 202 });
  } catch (error) {
    console.error("[admin/blog/images POST]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "KIE image generation could not be started.",
      },
      { status: 400 }
    );
  }
}
