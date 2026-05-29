"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Input } from "@kupon/ui";
import RichEditor from "@/components/ui/RichEditor";
import { FadeUp } from "@/components/motion/StaggerReveal";
import { ArrowLeft } from "@phosphor-icons/react";
import Link from "next/link";

const blogCategories = ["Guide", "News", "Opinion", "List", "Tutorial", "Review"];

export default function NewBlogPostPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");

  const handleTitleChange = (val: string) => {
    setTitle(val);
    setSlug(
      val
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
    );
  };

  return (
    <div className="max-w-4xl space-y-6">
      <FadeUp>
        <Link
          href="/admin/blog"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent transition-colors group"
        >
          <ArrowLeft
            size={14}
            className="transition-transform group-hover:-translate-x-1"
          />
          Back to posts
        </Link>
      </FadeUp>

      <FadeUp delay={0.05}>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">
            New Blog Post
          </h2>
          <div className="flex items-center gap-2">
            <Badge variant={status === "published" ? "accent" : "muted"}>
              {status}
            </Badge>
          </div>
        </div>
      </FadeUp>

      {/* Meta */}
      <FadeUp delay={0.1}>
        <Card variant="default" padding="lg" className="space-y-5">
          <h3 className="text-sm font-semibold text-text-primary">
            Post Details
          </h3>
          <Input
            label="Title"
            placeholder="Your blog post title"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
          />
          <Input
            label="Slug"
            placeholder="your-blog-post-title"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">
              Excerpt
            </label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="A short summary for SEO and social sharing..."
              rows={2}
              className="w-full rounded-xl bg-bg-card border border-border px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted transition-all focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 hover:border-white/20 resize-none"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-secondary">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl bg-bg-card border border-border px-3 h-10 text-sm text-text-primary transition-all focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 hover:border-white/20 cursor-pointer"
              >
                <option value="">Select category</option>
                {blogCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Cover Image URL"
              placeholder="https://example.com/cover.jpg"
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
            />
          </div>
        </Card>
      </FadeUp>

      {/* Editor */}
      <FadeUp delay={0.15}>
        <Card variant="default" padding="lg" className="space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">Content</h3>
          <RichEditor
            content={content}
            onChange={setContent}
            placeholder="Write your blog post here..."
          />
        </Card>
      </FadeUp>

      {/* Actions */}
      <FadeUp delay={0.2}>
        <div className="flex items-center gap-3">
          <Button
            size="lg"
            onClick={() => setStatus("published")}
          >
            Publish
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => setStatus("draft")}
          >
            Save as Draft
          </Button>
          <Button variant="ghost" size="lg" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </FadeUp>
    </div>
  );
}
