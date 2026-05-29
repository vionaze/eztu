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
}

export default function BlogPostContent({ post }: { post: BlogPost }) {
  return (
    <div className="min-h-[100dvh] pt-24 pb-20">
      <div className="max-w-3xl mx-auto px-4 md:px-8">
        {/* Back */}
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

        {/* Header */}
        <FadeUp delay={0.05}>
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="accent">{post.category}</Badge>
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
            <p className="text-base text-text-secondary mt-4 leading-relaxed">
              {post.excerpt}
            </p>
          </div>
        </FadeUp>

        {/* Cover Image */}
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

        {/* Content */}
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

        {/* Footer CTA */}
        <FadeUp delay={0.2}>
          <div className="mt-16 pt-8 border-t border-border text-center">
            <h3 className="text-lg font-bold text-text-primary mb-2">
              Ready to top up?
            </h3>
            <p className="text-sm text-text-secondary mb-5">
              Browse our collection of gaming vouchers with instant crypto
              payments.
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
