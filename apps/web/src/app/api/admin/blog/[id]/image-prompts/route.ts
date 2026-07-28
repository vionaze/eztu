import { NextResponse } from "next/server";
import { prisma } from "@kupon/db";
import { requireAdminUser } from "@/lib/clerk";
import { generateBlogImagePrompts } from "@/lib/blog-ai";
import { writeAppLog } from "@/lib/app-log";
import { formatExistingBlogImagePrompt } from "@/lib/blog-image-prompt";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminUser();
    const { id } = await context.params;
    const post = await prisma.blogPost.findUnique({ where: { id } });
    if (!post) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }
    const existingHero = formatExistingBlogImagePrompt(
      post.heroImagePrompt,
      post.title,
      "hero"
    );
    const existingThumbnail = formatExistingBlogImagePrompt(
      post.thumbnailImagePrompt,
      post.title,
      "thumbnail"
    );

    if (existingHero && existingThumbnail) {
      if (
        existingHero !== post.heroImagePrompt ||
        existingThumbnail !== post.thumbnailImagePrompt
      ) {
        await prisma.blogPost.update({
          where: { id },
          data: {
            heroImagePrompt: existingHero,
            thumbnailImagePrompt: existingThumbnail,
          },
        });
      }
      return NextResponse.json({
        skipped: true,
        prompts: {
          heroImagePrompt: existingHero,
          thumbnailImagePrompt: existingThumbnail,
        },
      });
    }

    const generated = await generateBlogImagePrompts({
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      countryCode: post.countryCode,
    });
    const updated = await prisma.blogPost.update({
      where: { id },
      data: {
        heroImagePrompt: existingHero || generated.heroImagePrompt,
        thumbnailImagePrompt:
          existingThumbnail || generated.thumbnailImagePrompt,
      },
      select: {
        heroImagePrompt: true,
        thumbnailImagePrompt: true,
      },
    });
    await writeAppLog({
      category: "BLOG",
      level: "SUCCESS",
      title: `Image prompts generated: ${post.title}`,
      actor: admin.email || admin.dbUserId,
      route: `/api/admin/blog/${id}/image-prompts`,
      metadata: { postId: id, imageApiCalled: false },
    });
    return NextResponse.json({ skipped: false, prompts: updated });
  } catch (error) {
    console.error("[blog image prompts]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed." },
      { status: 500 }
    );
  }
}
