import "server-only";
import { prisma, Prisma, type BlogPost } from "@kupon/db";

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
        url: `${SITE_URL}/new-logo-eztopup.png`,
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

export const BLOG_PAGE_SIZE = 12;

const BLOG_LIST_SELECT = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  // Only needed to estimate reading time; it is never sent to the client.
  content: true,
  coverImage: true,
  thumbnailImage: true,
  category: true,
  countryCode: true,
  publishedAt: true,
  createdAt: true,
} satisfies Prisma.BlogPostSelect;

export type BlogListPost = Prisma.BlogPostGetPayload<{
  select: typeof BLOG_LIST_SELECT;
}>;

/**
 * The listing used to load every published post (with full article bodies),
 * which reached ~7 MB of HTML at 1.4k posts. Keep it paginated.
 */
export async function getPublishedPostsPage(requestedPage: number) {
  const where = { published: true } satisfies Prisma.BlogPostWhereInput;
  const total = await prisma.blogPost.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE));
  const page = Math.min(
    Math.max(1, Math.floor(requestedPage) || 1),
    totalPages,
  );
  const posts = await prisma.blogPost.findMany({
    where,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * BLOG_PAGE_SIZE,
    take: BLOG_PAGE_SIZE,
    select: BLOG_LIST_SELECT,
  });

  return { posts, page, totalPages, total };
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
