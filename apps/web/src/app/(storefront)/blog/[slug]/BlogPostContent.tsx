"use client";

import Image from "next/image";
import Link from "next/link";
import { Badge, Button } from "@kupon/ui";
import { FadeUp } from "@/components/motion/StaggerReveal";
import { ArrowLeft, Clock, CalendarBlank } from "@phosphor-icons/react";

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  readTime: string;
  coverImage: string;
  content: string;
  countryCode?: string;
  faq?: { question: string; answer: string }[];
}

export default function BlogPostContent({ post }: { post: BlogPost }) {
  return (
    <div className="min-h-[100dvh] pt-24 pb-20">
      <div className="max-w-3xl mx-auto px-4 md:px-8">
        <FadeUp>
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent transition-colors group mb-8"
          >
            <ArrowLeft
              size={14}
              className="transition-transform group-hover:-translate-x-1"
            />
            Back to blog
          </Link>
        </FadeUp>

        <FadeUp delay={0.05}>
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <Badge variant="accent">{post.category}</Badge>
              {post.countryCode ? (
                <span className="text-[10px] font-mono text-text-muted border border-border rounded px-1.5 py-0.5">
                  {post.countryCode}
                </span>
              ) : null}
              <span className="flex items-center gap-1 text-xs text-text-muted">
                <CalendarBlank size={12} />
                {post.date}
              </span>
              <span className="flex items-center gap-1 text-xs text-text-muted">
                <Clock size={12} />
                {post.readTime}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-text-primary leading-tight">
              {post.title}
            </h1>
            {post.excerpt ? (
              <p className="text-base text-text-secondary mt-4 leading-relaxed">
                {post.excerpt}
              </p>
            ) : null}
          </div>
        </FadeUp>

        {post.coverImage ? (
          <FadeUp delay={0.1}>
            <div className="relative aspect-[2/1] rounded-2xl overflow-hidden border border-white/[0.08] mb-10">
              <Image
                src={post.coverImage}
                alt={post.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 768px"
                priority
              />
            </div>
          </FadeUp>
        ) : null}

        <FadeUp delay={0.15}>
          <article
            className="prose prose-invert prose-sm md:prose-base max-w-none
              prose-headings:text-text-primary prose-headings:font-bold prose-headings:tracking-tight
              prose-p:text-text-secondary prose-p:leading-relaxed
              prose-a:text-accent prose-a:no-underline hover:prose-a:underline
              prose-strong:text-text-primary prose-strong:font-semibold
              prose-li:text-text-secondary
              prose-blockquote:border-accent/30 prose-blockquote:text-text-muted prose-blockquote:not-italic
              prose-code:text-accent prose-code:bg-bg-card prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-xs
              prose-hr:border-border"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </FadeUp>

        {post.faq && post.faq.length > 0 ? (
          <FadeUp delay={0.18}>
            <section className="mt-12 space-y-4">
              <h2 className="text-xl font-bold text-text-primary">FAQ</h2>
              <div className="space-y-3">
                {post.faq.map((item, i) => (
                  <details
                    key={i}
                    className="group rounded-xl border border-border bg-bg-card/50 px-4 py-3"
                  >
                    <summary className="cursor-pointer text-sm font-medium text-text-primary list-none flex justify-between gap-2">
                      {item.question}
                      <span className="text-text-muted group-open:rotate-45 transition-transform">
                        +
                      </span>
                    </summary>
                    <p className="text-sm text-text-secondary mt-2 leading-relaxed">
                      {item.answer}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          </FadeUp>
        ) : null}

        <FadeUp delay={0.2}>
          <div className="mt-16 pt-8 border-t border-border text-center">
            <h3 className="text-lg font-bold text-text-primary mb-2">
              Ready to top up?
            </h3>
            <p className="text-sm text-text-secondary mb-5">
              Browse gaming vouchers with USDT / USDC checkout.
            </p>
            <Link href="/products">
              <Button size="lg">Browse Products</Button>
            </Link>
          </div>
        </FadeUp>
      </div>
    </div>
  );
}
