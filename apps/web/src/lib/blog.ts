import "server-only";
import { prisma, type BlogPost } from "@kupon/db";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://eztopup.io";

export function estimateReadTime(html: string) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = text ? text.split(" ").length : 0;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

export function formatBlogDate(date: Date | null | undefined) {
  if (!date) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export type FaqItem = { question: string; answer: string };

export function extractFaq(post: Pick<BlogPost, "structuredData">): FaqItem[] {
  const data = post.structuredData as { faq?: FaqItem[] } | null;
  if (!data || !Array.isArray(data.faq)) return [];
  return data.faq.filter(
    (f) => f && typeof f.question === "string" && typeof f.answer === "string"
  );
}

/** JSON-LD Article + optional FAQPage for Google SERP 2026-friendly structured data */
export function buildBlogJsonLd(post: BlogPost) {
  const url = post.canonicalUrl || `${SITE_URL}/blog/${post.slug}`;
  const image = post.coverImage || post.thumbnailImage || undefined;
  const faq = extractFaq(post);

  const article = {
    "@type": "Article",
    headline: post.metaTitle || post.title,
    description: post.metaDescription || post.excerpt || undefined,
    image: image ? [image] : undefined,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: {
      "@type": "Organization",
      name: "EZTopUp",
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "EZTopUp",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    keywords: post.focusKeyword || undefined,
    inLanguage:
      post.countryCode === "ID"
        ? "id-ID"
        : post.countryCode === "MY"
          ? "en-MY"
          : post.countryCode === "MX"
            ? "es-MX"
          : "en",
  };

  const graph: Record<string, unknown>[] = [article];

  if (faq.length > 0) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    });
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

export async function getPublishedPosts() {
  return prisma.blogPost.findMany({
    where: { published: true },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function getPublishedPostBySlug(slug: string) {
  return prisma.blogPost.findFirst({
    where: { slug, published: true },
  });
}
