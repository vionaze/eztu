import "server-only";

type BlogPublishedNotification = {
  postId: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  countryCode: string;
  category?: string | null;
  aiModel?: string | null;
  publishedAt?: Date | null;
};

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function getArticleUrl(slug: string) {
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://eztopup.io"
  ).replace(/\/+$/, "");
  return `${baseUrl}/blog/${encodeURIComponent(slug)}`;
}

/**
 * Notify the content team after an AI article is safely persisted as published.
 * Discord errors never bubble up into the publishing flow.
 */
export async function sendDiscordBlogPublishedNotification(
  article: BlogPublishedNotification
): Promise<boolean> {
  const webhookUrl =
    process.env.DISCORD_BLOG_WEBHOOK_URL?.trim() ||
    process.env.DISCORD_WEBHOOK_URL?.trim();

  if (!webhookUrl) return false;

  const articleUrl = getArticleUrl(article.slug);
  const publishedAt = article.publishedAt ?? new Date();

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "EZTopUp Blog Bot",
        allowed_mentions: { parse: [] },
        embeds: [
          {
            title: `📝 ${truncate(article.title, 250)}`,
            ...(article.excerpt?.trim()
              ? { description: truncate(article.excerpt.trim(), 1_000) }
              : {}),
            url: articleUrl,
            color: 0xa855f7,
            fields: [
              {
                name: "Market",
                value: article.countryCode.toUpperCase(),
                inline: true,
              },
              {
                name: "Status",
                value: "PUBLISHED",
                inline: true,
              },
              {
                name: "Kategori",
                value: truncate(article.category?.trim() || "Guide", 100),
                inline: true,
              },
              {
                name: "Model AI",
                value: truncate(article.aiModel?.trim() || "—", 100),
                inline: true,
              },
              {
                name: "Buka artikel",
                value: `[Lihat di EZTopUp](${articleUrl})`,
                inline: false,
              },
            ],
            footer: {
              text: `Post ID: ${article.postId}`,
            },
            timestamp: publishedAt.toISOString(),
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error(
        `[discord-blog] Webhook rejected article ${article.postId}: ${response.status}`
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error(
      `[discord-blog] Failed to notify article ${article.postId}:`,
      error
    );
    return false;
  }
}
