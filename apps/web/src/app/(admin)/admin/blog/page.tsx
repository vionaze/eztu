"use client";

import Link from "next/link";
import { Badge, Button, Card } from "@kupon/ui";
import { FadeUp, StaggerReveal, StaggerItem } from "@/components/motion/StaggerReveal";
import {
  Plus,
  PencilSimple,
  Trash,
  Eye,
  Article,
} from "@phosphor-icons/react";

// Dummy blog posts for admin
const blogPosts = [
  { id: "1", title: "How to Top-Up Mobile Legends with Crypto", status: "published", category: "Guide", date: "Apr 28, 2026", views: 1234 },
  { id: "2", title: "Genshin Impact 5.2 Update: New Characters & Events", status: "published", category: "News", date: "Apr 25, 2026", views: 856 },
  { id: "3", title: "Why Crypto Payments Are the Future of Gaming", status: "draft", category: "Opinion", date: "Apr 20, 2026", views: 0 },
  { id: "4", title: "Top 10 Mobile Games of 2026", status: "published", category: "List", date: "Apr 15, 2026", views: 2340 },
];

export default function AdminBlogPage() {
  return (
    <div className="space-y-6">
      <FadeUp>
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-secondary">
            {blogPosts.length} posts
          </p>
          <Link href="/admin/blog/new">
            <Button>
              <Plus size={16} weight="bold" />
              New Post
            </Button>
          </Link>
        </div>
      </FadeUp>

      <StaggerReveal className="space-y-3">
        {blogPosts.map((post) => (
          <StaggerItem key={post.id}>
            <Card
              variant="default"
              padding="none"
              className="flex items-center justify-between px-5 py-4 hover:border-accent/20 flex-wrap sm:flex-nowrap gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-bg-elevated flex items-center justify-center flex-shrink-0">
                  <Article size={18} className="text-text-muted" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {post.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge
                      variant={
                        post.status === "published" ? "accent" : "muted"
                      }
                    >
                      {post.status}
                    </Badge>
                    <span className="text-xs text-text-muted">
                      {post.category}
                    </span>
                    <span className="text-xs text-text-muted">
                      · {post.date}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-[family-name:var(--font-geist-mono)] text-text-primary">
                    {post.views.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-text-muted">views</p>
                </div>
                <div className="flex items-center gap-1">
                  <button className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/5 transition-all cursor-pointer">
                    <Eye size={16} />
                  </button>
                  <Link
                    href={`/admin/blog/${post.id}/edit`}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-accent hover:bg-accent/5 transition-all"
                  >
                    <PencilSimple size={16} />
                  </Link>
                  <button className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-400/5 transition-all cursor-pointer">
                    <Trash size={16} />
                  </button>
                </div>
              </div>
            </Card>
          </StaggerItem>
        ))}
      </StaggerReveal>

      <FadeUp delay={0.2}>
        <Card variant="glass" padding="md" className="text-center">
          <p className="text-sm text-text-muted">
            Full blog editor with TipTap rich text is coming in Phase 4.
          </p>
        </Card>
      </FadeUp>
    </div>
  );
}
