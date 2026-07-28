import { notFound } from "next/navigation";
import { prisma } from "@kupon/db";
import BlogPostForm from "@/components/admin/BlogPostForm";
import { getBlogAiSettings } from "@/lib/settings";
import { extractFaq } from "@/lib/blog";
import { formatExistingBlogImagePrompt } from "@/lib/blog-image-prompt";

export const dynamic = "force-dynamic";

export default async function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [post, ai] = await Promise.all([
    prisma.blogPost.findUnique({ where: { id } }),
    getBlogAiSettings(),
  ]);

  if (!post) notFound();

  const countries =
    ai.countries.length > 0
      ? ai.countries
      : ["GLOBAL", "ID", "MY", "US", "PH", "SG"];

  return (
    <BlogPostForm
      countries={countries}
      initial={{
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt || "",
        content: post.content,
        coverImage: post.coverImage || "",
        thumbnailImage: post.thumbnailImage || "",
        heroImagePrompt: formatExistingBlogImagePrompt(
          post.heroImagePrompt,
          post.title,
          "hero"
        ),
        thumbnailImagePrompt: formatExistingBlogImagePrompt(
          post.thumbnailImagePrompt,
          post.title,
          "thumbnail"
        ),
        category: post.category || "Guide",
        countryCode: post.countryCode,
        metaTitle: post.metaTitle || "",
        metaDescription: post.metaDescription || "",
        focusKeyword: post.focusKeyword || "",
        canonicalUrl: post.canonicalUrl || "",
        ogTitle: post.ogTitle || "",
        ogDescription: post.ogDescription || "",
        published: post.published,
        aiGenerated: post.aiGenerated,
        aiModel: post.aiModel || "",
        faq: extractFaq(post),
      }}
    />
  );
}
