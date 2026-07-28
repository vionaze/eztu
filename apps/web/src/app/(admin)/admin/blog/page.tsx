import Link from "next/link";
import Image from "next/image";
import { prisma } from "@kupon/db";
import { Badge, Button, Card } from "@kupon/ui";
import { Plus, Article } from "@phosphor-icons/react/dist/ssr";
import BlogDeleteButton from "./BlogDeleteButton";
import { formatAdminDateTimeShort } from "@/lib/utils";
import BlogPromptBackfillButton from "./BlogPromptBackfillButton";

export const dynamic = "force-dynamic";

export default async function AdminBlogPage() {
  const posts = await prisma.blogPost.findMany({
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });

  return (
    <>
      <div className="admin-page-toolbar">
        <div>
          <p className="text-[13px] text-text-secondary">
            {posts.length} post{posts.length === 1 ? "" : "s"}
          </p>
          <p className="admin-hint">
            Manual form default · AI helper opsional di New Post
          </p>
        </div>
        <div className="flex flex-wrap items-start justify-end gap-2">
          <BlogPromptBackfillButton />
          <Link href="/admin/blog/new">
            <Button size="sm">
              <Plus size={15} weight="bold" />
              New Post
            </Button>
          </Link>
        </div>
      </div>

      {posts.length === 0 ? (
        <Card padding="md" className="text-center py-6 space-y-2.5">
          <p className="text-[13px] text-text-muted">
            Belum ada artikel. Buat manual — AI tidak wajib.
          </p>
          <Link href="/admin/blog/new">
            <Button variant="secondary" size="sm">
              Tulis artikel
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => {
            const thumb = post.thumbnailImage || post.coverImage;
            return (
              <Card
                key={post.id}
                padding="none"
                className="flex items-center justify-between px-3 py-2.5 gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-bg-elevated shrink-0">
                    {thumb ? (
                      <Image
                        src={thumb}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="44px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Article size={16} className="text-text-muted" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-text-primary truncate">
                      {post.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <Badge variant={post.published ? "accent" : "muted"}>
                        {post.published ? "published" : "draft"}
                      </Badge>
                      {post.aiGenerated ? (
                        <Badge variant="muted">AI</Badge>
                      ) : null}
                      {post.heroImagePrompt && post.thumbnailImagePrompt ? (
                        <Badge variant="muted">prompts ready</Badge>
                      ) : null}
                      <span className="text-[11px] text-text-muted">
                        {post.category || "—"} · {post.countryCode} ·{" "}
                        {formatAdminDateTimeShort(
                          post.publishedAt || post.createdAt
                        )}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-mono text-text-muted hidden sm:block">
                    {post.views} views
                  </span>
                  {post.published ? (
                    <Link
                      href={`/blog/${post.slug}`}
                      target="_blank"
                      className="text-[11px] text-accent hover:underline"
                    >
                      View
                    </Link>
                  ) : null}
                  <Link
                    href={`/admin/blog/${post.id}/edit`}
                    className="text-[11px] text-text-secondary hover:text-accent"
                  >
                    Edit
                  </Link>
                  <BlogDeleteButton id={post.id} title={post.title} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
