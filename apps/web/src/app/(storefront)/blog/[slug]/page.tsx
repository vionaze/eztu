import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BlogPostContent from "./BlogPostContent";
import BlogViewTracker from "./BlogViewTracker";
import {
  buildBlogJsonLd,
  estimateReadTime,
  extractFaq,
  formatBlogDate,
  getPublishedPostBySlug,
} from "@/lib/blog";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://eztopup.io";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) return { title: "Post Not Found" };

  const title = post.metaTitle || post.title;
  const description =
    post.metaDescription || post.excerpt || "EZTopUp blog article";
  const ogTitle = post.ogTitle || title;
  const ogDescription = post.ogDescription || description;
  const image = post.coverImage || post.thumbnailImage || undefined;
  const canonical = post.canonicalUrl || `${SITE_URL}/blog/${post.slug}`;

  return {
    title,
    description,
    keywords: post.focusKeyword || undefined,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title: ogTitle,
      description: ogDescription,
      url: canonical,
      siteName: "EZTopUp",
      locale:
        post.countryCode === "ID"
          ? "id_ID"
          : post.countryCode === "MY"
            ? "en_MY"
            : "en_US",
      images: image
        ? [{ url: image, width: 1200, height: 630, alt: post.title }]
        : undefined,
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: image ? [image] : undefined,
    },
    robots: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) notFound();

  const jsonLd = buildBlogJsonLd(post);
  const faq = extractFaq(post);

  return (
    <>
      <BlogViewTracker slug={post.slug} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BlogPostContent
        post={{
          id: post.id,
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt || "",
          category: post.category || "Guide",
          date: formatBlogDate(post.publishedAt || post.createdAt),
          readTime: estimateReadTime(post.content),
          coverImage: post.coverImage || post.thumbnailImage || "",
          content: post.content,
          countryCode: post.countryCode,
          faq,
        }}
      />
    </>
  );
}
