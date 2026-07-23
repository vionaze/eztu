import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { FadeUp, StaggerReveal, StaggerItem } from "@/components/motion/StaggerReveal";
import { Badge, Card } from "@kupon/ui";
import { Clock, CalendarBlank, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import {
  estimateReadTime,
  formatBlogDate,
  getPublishedPosts,
} from "@/lib/blog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Digital voucher, crypto payment, and gaming commerce guides from EZTopUp.",
};

export default async function BlogPage() {
  const posts = await getPublishedPosts();
  const featured = posts[0];
  const rest = posts.slice(1);

  return (
    <div className="min-h-[100dvh] pt-28 pb-20">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8">
        <FadeUp>
          <div className="mb-10">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tighter text-text-primary">
              Blog
            </h1>
            <p className="text-base text-text-secondary mt-3 max-w-[55ch] leading-relaxed">
              Practical guides for game top-ups, USDT/USDC payments, and digital
              vouchers — written for real shoppers, not keyword spam.
            </p>
          </div>
        </FadeUp>

        {posts.length === 0 ? (
          <Card padding="lg" className="text-center text-sm text-text-muted">
            Articles are coming soon. Check back after the team publishes the
            first guide.
          </Card>
        ) : (
          <>
            {featured ? (
              <FadeUp delay={0.05}>
                <Link
                  href={`/blog/${featured.slug}`}
                  className="block mb-10"
                >
                  <Card
                    variant="interactive"
                    padding="none"
                    className="overflow-hidden"
                  >
                    <div className="grid md:grid-cols-2 gap-0">
                      <div className="relative aspect-[16/10] md:aspect-auto md:min-h-[280px] bg-bg-elevated">
                        {(featured.coverImage || featured.thumbnailImage) && (
                          <Image
                            src={
                              featured.coverImage ||
                              featured.thumbnailImage ||
                              ""
                            }
                            alt={featured.title}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 100vw, 50vw"
                            priority
                          />
                        )}
                      </div>
                      <div className="p-6 md:p-8 flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-3">
                          {featured.category ? (
                            <Badge variant="accent">{featured.category}</Badge>
                          ) : null}
                          <span className="text-xs text-text-muted font-mono">
                            {featured.countryCode}
                          </span>
                        </div>
                        <h2 className="text-xl md:text-2xl font-bold text-text-primary tracking-tight">
                          {featured.title}
                        </h2>
                        {featured.excerpt ? (
                          <p className="text-sm text-text-secondary mt-3 line-clamp-3 leading-relaxed">
                            {featured.excerpt}
                          </p>
                        ) : null}
                        <div className="flex items-center gap-3 mt-4 text-xs text-text-muted">
                          <span className="inline-flex items-center gap-1">
                            <CalendarBlank size={12} />
                            {formatBlogDate(
                              featured.publishedAt || featured.createdAt
                            )}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock size={12} />
                            {estimateReadTime(featured.content)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-accent ml-auto">
                            Read <ArrowRight size={12} />
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              </FadeUp>
            ) : null}

            <StaggerReveal className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {rest.map((post) => {
                const img = post.thumbnailImage || post.coverImage;
                return (
                  <StaggerItem key={post.id}>
                    <Link href={`/blog/${post.slug}`} className="block h-full">
                      <Card
                        variant="interactive"
                        padding="none"
                        className="overflow-hidden h-full flex flex-col"
                      >
                        <div className="relative aspect-[16/10] bg-bg-elevated">
                          {img ? (
                            <Image
                              src={img}
                              alt={post.title}
                              fill
                              className="object-cover"
                              sizes="(max-width: 768px) 100vw, 33vw"
                            />
                          ) : null}
                        </div>
                        <div className="p-4 flex flex-col flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {post.category ? (
                              <Badge variant="muted">{post.category}</Badge>
                            ) : null}
                            <span className="text-[10px] text-text-muted font-mono">
                              {post.countryCode}
                            </span>
                          </div>
                          <h3 className="text-sm font-semibold text-text-primary line-clamp-2">
                            {post.title}
                          </h3>
                          {post.excerpt ? (
                            <p className="text-xs text-text-secondary mt-2 line-clamp-2 flex-1">
                              {post.excerpt}
                            </p>
                          ) : null}
                          <div className="flex items-center gap-2 mt-3 text-[10px] text-text-muted">
                            <span>
                              {formatBlogDate(
                                post.publishedAt || post.createdAt
                              )}
                            </span>
                            <span>·</span>
                            <span>{estimateReadTime(post.content)}</span>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  </StaggerItem>
                );
              })}
            </StaggerReveal>
          </>
        )}
      </div>
    </div>
  );
}
