import Link from "next/link";
import Image from "next/image";
import { prisma } from "@kupon/db";
import { Badge, Button, Card } from "@kupon/ui";
import { Plus, Article } from "@phosphor-icons/react/dist/ssr";
import BlogDeleteButton from "./BlogDeleteButton";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function AdminBlogPage() {
  const posts = await prisma.blogPost.findMany({
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          {posts.length} post{posts.length === 1 ? "" : "s"} in database
        </p>
        <Link href="/admin/blog/new">
          <Button>
            <Plus size={16} weight="bold" />
            New Post
          </Button>
        </Link>
      </div>

      <div className="space-y-3">
        {posts.length === 0 ? (
          <Card padding="lg" className="text-center space-y-3">
            <p className="text-sm text-text-muted">
              No blog posts yet. Create one manually or generate with AI.
            </p>
            <Link href="/admin/blog/new">
              <Button variant="secondary">Create first post</Button>
            </Link>
          </Card>
        ) : (
          posts.map((post) => {
            const thumb = post.thumbnailImage || post.coverImage;
            return (
              <Card
                key={post.id}
                padding="none"
                className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap sm:flex-nowrap"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-bg-elevated shrink-0">
                    {thumb ? (
                      <Image
                        src={thumb}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Article size={18} className="text-text-muted" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {post.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <Badge variant={post.published ? "accent" : "muted"}>
                        {post.published ? "published" : "draft"}
                      </Badge>
                      {post.aiGenerated ? (
                        <Badge variant="muted">AI</Badge>
                      ) : null}
                      <span className="text-xs text-text-muted">
                        {post.category || "—"}
                      </span>
                      <span className="text-xs text-text-muted font-mono">
                        {post.countryCode}
                      </span>
                      <span className="text-xs text-text-muted">
                        · {formatDate(post.publishedAt || post.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-mono text-text-primary">
                      {post.views.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-text-muted">views</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {post.published ? (
                      <Link
                        href={`/blog/${post.slug}`}
                        target="_blank"
                        className="text-xs text-accent hover:text-accent-hover px-2"
                      >
                        View
                      </Link>
                    ) : null}
                    <Link
                      href={`/admin/blog/${post.id}/edit`}
                      className="text-xs text-text-secondary hover:text-accent px-2"
                    >
                      Edit
                    </Link>
                    <BlogDeleteButton id={post.id} title={post.title} />
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
