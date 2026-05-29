import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://eztopup.io";

  // Static pages
  const staticPages = [
    "",
    "/products",
    "/vouchers",
    "/blog",
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.8,
  }));

  // Product pages — would come from database in production
  const productSlugs = [
    "mobile-legends",
    "genshin-impact",
    "free-fire",
    "pubg-mobile",
    "valorant",
    "steam-wallet",
    "playstation-store",
    "netflix",
    "honkai-star-rail",
  ];

  const productPages = productSlugs.map((slug) => ({
    url: `${baseUrl}/products/${slug}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  // Blog pages
  const blogSlugs = [
    "how-to-top-up-mobile-legends-with-crypto",
    "genshin-impact-5-2-update",
    "why-crypto-payments-future-of-gaming",
    "top-10-mobile-games-2026",
  ];

  const blogPages = blogSlugs.map((slug) => ({
    url: `${baseUrl}/blog/${slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...productPages, ...blogPages];
}
