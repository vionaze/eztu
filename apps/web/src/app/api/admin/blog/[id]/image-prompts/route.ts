import { NextResponse } from "next/server";
import { prisma } from "@kupon/db";
import { requireAdminUser } from "@/lib/clerk";
import { generateBlogImagePrompts } from "@/lib/blog-ai";
import { writeAppLog } from "@/lib/app-log";

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
    if (post.heroImagePrompt && post.thumbnailImagePrompt) {
      return NextResponse.json({
        skipped: true,
        prompts: {
          heroImagePrompt: post.heroImagePrompt,
          thumbnailImagePrompt: post.thumbnailImagePrompt,
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
        ...(post.heroImagePrompt
          ? {}
          : { heroImagePrompt: generated.heroImagePrompt }),
        ...(post.thumbnailImagePrompt
          ? {}
          : { thumbnailImagePrompt: generated.thumbnailImagePrompt }),
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
