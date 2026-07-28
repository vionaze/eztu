import { NextResponse } from "next/server";
import { prisma } from "@kupon/db";
import { requireAdminUser } from "@/lib/clerk";
import { generateBlogImagePrompts } from "@/lib/blog-ai";
import { writeAppLog } from "@/lib/app-log";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  try {
    const admin = await requireAdminUser();
    const posts = await prisma.blogPost.findMany({
      where: {
        published: true,
        OR: [
          {
            AND: [
              { OR: [{ coverImage: null }, { coverImage: "" }] },
              {
                OR: [
                  { heroImagePrompt: null },
                  { heroImagePrompt: "" },
                ],
              },
            ],
          },
          {
            AND: [
              {
                OR: [
                  { thumbnailImage: null },
                  { thumbnailImage: "" },
                ],
              },
              {
                OR: [
                  { thumbnailImagePrompt: null },
                  { thumbnailImagePrompt: "" },
                ],
              },
            ],
          },
        ],
      },
      orderBy: { publishedAt: "desc" },
      take: 20,
    });
    const updated: string[] = [];
    const errors: string[] = [];
    for (const post of posts) {
      try {
        const prompts = await generateBlogImagePrompts({
          title: post.title,
          excerpt: post.excerpt,
          content: post.content,
          countryCode: post.countryCode,
        });
        const heroMissing =
          !post.coverImage?.trim() && !post.heroImagePrompt?.trim();
        const thumbnailMissing =
          !post.thumbnailImage?.trim() &&
          !post.thumbnailImagePrompt?.trim();
        await prisma.blogPost.update({
          where: { id: post.id },
          data: {
            ...(heroMissing
              ? { heroImagePrompt: prompts.heroImagePrompt }
              : {}),
            ...(thumbnailMissing
              ? { thumbnailImagePrompt: prompts.thumbnailImagePrompt }
              : {}),
          },
        });
        updated.push(post.id);
      } catch (error) {
        errors.push(
          `${post.title}: ${error instanceof Error ? error.message : "failed"}`
        );
      }
    }
    await writeAppLog({
      category: "BLOG",
      level: errors.length ? "WARNING" : "SUCCESS",
      title: `Image prompt backfill: ${updated.length}/${posts.length}`,
      actor: admin.email || admin.dbUserId,
      route: "/api/admin/blog/image-prompts/backfill",
      message: errors.slice(0, 5).join("; ") || undefined,
      metadata: {
        updatedPostIds: updated,
        errors: errors.length,
        imageApiCalled: false,
      },
    });
    return NextResponse.json({
      scanned: posts.length,
      updated: updated.length,
      errors,
      remainingMayExist: posts.length === 20,
    });
  } catch (error) {
    console.error("[blog prompt backfill]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Backfill failed." },
      { status: 500 }
    );
  }
}
