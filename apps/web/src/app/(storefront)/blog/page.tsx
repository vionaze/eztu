import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { FadeUp, StaggerReveal, StaggerItem } from "@/components/motion/StaggerReveal";
import { Badge, Card } from "@kupon/ui";
import { Clock, CalendarBlank, ArrowRight } from "@phosphor-icons/react/dist/ssr";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Digital voucher, crypto payment, and gaming commerce updates from EZTopUp.",
};

const blogPosts = [
  {
    id: "1",
    slug: "how-to-top-up-mobile-legends-with-crypto",
    title: "How to Top-Up Mobile Legends with Crypto",
    excerpt:
      "A step-by-step guide to buying Mobile Legends diamonds using Bitcoin, Ethereum, or USDT through our platform.",
    category: "Guide",
    date: "Apr 28, 2026",
    readTime: "5 min read",
    coverImage: "https://picsum.photos/seed/blog1/800/400",
  },
  {
    id: "2",
    slug: "genshin-impact-5-2-update",
    title: "Genshin Impact 5.2 Update: New Characters & Events",
    excerpt:
      "Everything you need to know about the upcoming Genshin Impact update, including new characters, weapons, and events.",
    category: "News",
    date: "Apr 25, 2026",
    readTime: "8 min read",
    coverImage: "https://picsum.photos/seed/blog2/800/400",
  },
  {
    id: "3",
    slug: "why-crypto-payments-future-of-gaming",
    title: "Why Crypto Payments Are the Future of Gaming",
    excerpt:
      "Explore the benefits of using cryptocurrency for gaming purchases: lower fees, instant delivery, and global access.",
    category: "Opinion",
    date: "Apr 20, 2026",
    readTime: "6 min read",
    coverImage: "https://picsum.photos/seed/blog3/800/400",
  },
  {
    id: "4",
    slug: "top-10-mobile-games-2026",
    title: "Top 10 Mobile Games of 2026",
    excerpt:
      "Our curated list of the best mobile games this year, from battle royales to RPGs and everything in between.",
    category: "List",
    date: "Apr 15, 2026",
    readTime: "10 min read",
    coverImage: "https://picsum.photos/seed/blog4/800/400",
  },
];

export default function BlogPage() {
  return (
    <div className="min-h-[100dvh] pt-28 pb-20">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8">
        <FadeUp>
          <div className="mb-10">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tighter text-text-primary">
              Blog
            </h1>
            <p className="text-base text-text-secondary mt-3 max-w-[55ch] leading-relaxed">
              Digital voucher, crypto payment, and gaming commerce updates from
              the EZTopUp team.
            </p>
          </div>
        </FadeUp>

        {/* Featured Post */}
        <FadeUp delay={0.05}>
          <Link href={`/blog/${blogPosts[0].slug}`} className="block mb-10">
            <Card variant="interactive" padding="none" className="overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="relative aspect-[2/1] md:aspect-auto">
                  <Image
                    src={blogPosts[0].coverImage}
                    alt={blogPosts[0].title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
                <div className="p-6 md:p-8 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="accent">{blogPosts[0].category}</Badge>
                    <span className="text-xs text-text-muted">{blogPosts[0].date}</span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-text-primary tracking-tight mb-2">
                    {blogPosts[0].title}
                  </h2>
                  <p className="text-sm text-text-secondary leading-relaxed mb-4">
                    {blogPosts[0].excerpt}
                  </p>
                  <span className="text-sm text-accent flex items-center gap-1">
                    Read more <ArrowRight size={14} />
                  </span>
                </div>
              </div>
            </Card>
          </Link>
        </FadeUp>

        {/* Post Grid */}
        <StaggerReveal className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {blogPosts.slice(1).map((post) => (
            <StaggerItem key={post.id}>
              <Link href={`/blog/${post.slug}`} className="block h-full">
                <Card variant="interactive" padding="none" className="h-full overflow-hidden">
                  <div className="relative aspect-[2/1]">
                    <Image
                      src={post.coverImage}
                      alt={post.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="accent">{post.category}</Badge>
                      <span className="flex items-center gap-1 text-xs text-text-muted">
                        <Clock size={10} />
                        {post.readTime}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-text-primary tracking-tight mb-1.5">
                      {post.title}
                    </h3>
                    <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-text-muted mt-3">
                      <CalendarBlank size={10} />
                      {post.date}
                    </div>
                  </div>
                </Card>
              </Link>
            </StaggerItem>
          ))}
        </StaggerReveal>
      </div>
    </div>
  );
}
