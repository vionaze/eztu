import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const envFiles = [
  resolve(packageRoot, ".env"),
  resolve(packageRoot, "../../.env"),
  resolve(packageRoot, "../../apps/web/.env"),
];

for (const envFile of envFiles) {
  if (existsSync(envFile)) {
    loadEnv({ path: envFile });
    break;
  }
}

const { prisma } = await import("./index.ts");

const categories = [
  {
    id: "cat-1",
    name: "Mobile Games",
    slug: "mobile-games",
    image: "/images/categories/mobile-games.jpg",
  },
  {
    id: "cat-2",
    name: "PC Games",
    slug: "pc-games",
    image: "/images/categories/pc-games.jpg",
  },
  {
    id: "cat-3",
    name: "Console",
    slug: "console",
    image: "/images/categories/console.jpg",
  },
  {
    id: "cat-4",
    name: "Streaming",
    slug: "streaming",
    image: "/images/categories/streaming.jpg",
  },
] as const;

const products = [
  {
    id: "prod-1",
    name: "Mobile Legends",
    slug: "mobile-legends",
    description:
      "Top up diamonds for Mobile Legends: Bang Bang. Instant delivery to your account.",
    image: "https://picsum.photos/seed/ml/400/500",
    categoryId: "cat-1",
    featured: true,
    published: true,
    variants: [
      { id: "v1", name: "86 Diamonds", priceIDR: 19000, priceUSD: 1.2 },
      { id: "v2", name: "172 Diamonds", priceIDR: 38000, priceUSD: 2.4 },
      { id: "v3", name: "257 Diamonds", priceIDR: 57000, priceUSD: 3.6 },
      { id: "v4", name: "344 Diamonds", priceIDR: 76000, priceUSD: 4.8 },
      { id: "v5", name: "514 Diamonds", priceIDR: 114000, priceUSD: 7.2 },
      { id: "v6", name: "706 Diamonds", priceIDR: 152000, priceUSD: 9.6 },
    ],
  },
  {
    id: "prod-2",
    name: "Genshin Impact",
    slug: "genshin-impact",
    description: "Top up Genesis Crystals for Genshin Impact. All servers supported.",
    image: "https://picsum.photos/seed/genshin/400/500",
    categoryId: "cat-1",
    featured: true,
    published: true,
    variants: [
      { id: "v7", name: "60 Genesis Crystals", priceIDR: 16000, priceUSD: 1.0 },
      { id: "v8", name: "330 Genesis Crystals", priceIDR: 79000, priceUSD: 5.0 },
      { id: "v9", name: "1090 Genesis Crystals", priceIDR: 249000, priceUSD: 15.7 },
      { id: "v10", name: "2240 Genesis Crystals", priceIDR: 479000, priceUSD: 30.0 },
    ],
  },
  {
    id: "prod-3",
    name: "Free Fire",
    slug: "free-fire",
    description: "Top up Diamonds for Garena Free Fire. Fastest delivery guaranteed.",
    image: "https://picsum.photos/seed/freefire/400/500",
    categoryId: "cat-1",
    featured: true,
    published: true,
    variants: [
      { id: "v11", name: "100 Diamonds", priceIDR: 15000, priceUSD: 0.95 },
      { id: "v12", name: "310 Diamonds", priceIDR: 46000, priceUSD: 2.9 },
      { id: "v13", name: "520 Diamonds", priceIDR: 77000, priceUSD: 4.85 },
      { id: "v14", name: "1060 Diamonds", priceIDR: 153000, priceUSD: 9.6 },
    ],
  },
  {
    id: "prod-4",
    name: "PUBG Mobile",
    slug: "pubg-mobile",
    description: "Get UC for PUBG Mobile. Direct top-up to your account instantly.",
    image: "https://picsum.photos/seed/pubg/400/500",
    categoryId: "cat-1",
    featured: false,
    published: true,
    variants: [
      { id: "v15", name: "60 UC", priceIDR: 16000, priceUSD: 1.0 },
      { id: "v16", name: "325 UC", priceIDR: 79000, priceUSD: 5.0 },
      { id: "v17", name: "660 UC", priceIDR: 159000, priceUSD: 10.0 },
      { id: "v18", name: "1800 UC", priceIDR: 399000, priceUSD: 25.0 },
    ],
  },
  {
    id: "prod-5",
    name: "Valorant",
    slug: "valorant",
    description: "Purchase Valorant Points to unlock agents, skins, and battle passes.",
    image: "https://picsum.photos/seed/valorant/400/500",
    categoryId: "cat-2",
    featured: true,
    published: true,
    variants: [
      { id: "v19", name: "475 VP", priceIDR: 65000, priceUSD: 4.1 },
      { id: "v20", name: "1000 VP", priceIDR: 130000, priceUSD: 8.2 },
      { id: "v21", name: "2050 VP", priceIDR: 249000, priceUSD: 15.7 },
      { id: "v22", name: "5350 VP", priceIDR: 649000, priceUSD: 40.9 },
    ],
  },
  {
    id: "prod-6",
    name: "Steam Wallet",
    slug: "steam-wallet",
    description: "Top up your Steam Wallet. Use it to buy any game or in-game item on Steam.",
    image: "https://picsum.photos/seed/steam/400/500",
    categoryId: "cat-2",
    featured: true,
    published: true,
    variants: [
      { id: "v23", name: "$5 Steam Wallet", priceIDR: 79000, priceUSD: 5.0 },
      { id: "v24", name: "$10 Steam Wallet", priceIDR: 155000, priceUSD: 10.0 },
      { id: "v25", name: "$20 Steam Wallet", priceIDR: 310000, priceUSD: 20.0 },
      { id: "v26", name: "$50 Steam Wallet", priceIDR: 775000, priceUSD: 50.0 },
    ],
  },
  {
    id: "prod-7",
    name: "PlayStation Store",
    slug: "playstation-store",
    description: "PSN Gift Card for PlayStation Store. Buy games, DLC, and subscriptions.",
    image: "https://picsum.photos/seed/playstation/400/500",
    categoryId: "cat-3",
    featured: false,
    published: true,
    variants: [
      { id: "v27", name: "$10 PSN Card", priceIDR: 159000, priceUSD: 10.0 },
      { id: "v28", name: "$25 PSN Card", priceIDR: 395000, priceUSD: 25.0 },
      { id: "v29", name: "$50 PSN Card", priceIDR: 785000, priceUSD: 50.0 },
    ],
  },
  {
    id: "prod-8",
    name: "Netflix",
    slug: "netflix",
    description: "Netflix Gift Card. Enjoy movies, series, and documentaries without limits.",
    image: "https://picsum.photos/seed/netflix/400/500",
    categoryId: "cat-4",
    featured: false,
    published: true,
    variants: [
      { id: "v30", name: "1 Month Basic", priceIDR: 54000, priceUSD: 3.4 },
      { id: "v31", name: "1 Month Standard", priceIDR: 120000, priceUSD: 7.5 },
      { id: "v32", name: "1 Month Premium", priceIDR: 186000, priceUSD: 11.7 },
    ],
  },
  {
    id: "prod-9",
    name: "Honkai: Star Rail",
    slug: "honkai-star-rail",
    description: "Top up Oneiric Shards for Honkai: Star Rail. All servers supported.",
    image: "https://picsum.photos/seed/honkai/400/500",
    categoryId: "cat-1",
    featured: true,
    published: true,
    variants: [
      { id: "v33", name: "60 Oneiric Shards", priceIDR: 16000, priceUSD: 1.0 },
      { id: "v34", name: "330 Oneiric Shards", priceIDR: 79000, priceUSD: 5.0 },
      { id: "v35", name: "1090 Oneiric Shards", priceIDR: 249000, priceUSD: 15.7 },
    ],
  },
] as const;

async function main() {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { id: category.id },
      update: category,
      create: category,
    });
  }

  for (const product of products) {
    const { variants, ...productData } = product;

    await prisma.product.upsert({
      where: { id: product.id },
      update: productData,
      create: productData,
    });

    for (const variant of variants) {
      await prisma.productVariant.upsert({
        where: { id: variant.id },
        update: {
          ...variant,
          productId: product.id,
        },
        create: {
          ...variant,
          productId: product.id,
        },
      });
    }
  }

  console.log(`Seeded ${categories.length} categories and ${products.length} products.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
