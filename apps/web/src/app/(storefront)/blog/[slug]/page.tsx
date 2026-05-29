import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BlogPostContent from "./BlogPostContent";

// Expanded dummy blog data
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
    coverImage: "https://picsum.photos/seed/blog1/1200/600",
    content: `
      <h2>Why Use Crypto for Game Top-Ups?</h2>
      <p>Cryptocurrency payments offer several advantages for gamers: lower transaction fees, instant processing, and global accessibility without needing a bank account or credit card.</p>
      <h2>Step 1: Choose Your Package</h2>
      <p>Navigate to the <strong>Mobile Legends</strong> product page and select your desired diamond package. We offer packages ranging from 86 to 706 diamonds.</p>
      <h2>Step 2: Enter Your Game ID</h2>
      <p>Enter your Mobile Legends <em>User ID</em> and <em>Server ID</em>. You can find these in your game profile settings. Double-check the IDs to ensure the diamonds go to the right account.</p>
      <h2>Step 3: Pay with Crypto</h2>
      <p>Click the "Pay with Crypto" button. You'll be redirected to our secure payment gateway powered by <strong>NOWPayments</strong>. Choose your preferred cryptocurrency:</p>
      <ul>
        <li><strong>Bitcoin (BTC)</strong> — Most widely accepted</li>
        <li><strong>Ethereum (ETH)</strong> — Fast transactions</li>
        <li><strong>USDT (Tether)</strong> — Stable value, no price fluctuation</li>
      </ul>
      <h2>Step 4: Receive Your Diamonds</h2>
      <p>Once the payment is confirmed on the blockchain, your diamonds will be delivered <strong>instantly</strong> to your Mobile Legends account. The entire process typically takes 1-5 minutes.</p>
      <blockquote><p>Pro tip: USDT payments are usually the fastest since they don't have the same confirmation time as BTC or ETH.</p></blockquote>
    `,
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
    coverImage: "https://picsum.photos/seed/blog2/1200/600",
    content: `
      <h2>New Characters</h2>
      <p>Version 5.2 introduces two new playable characters to the roster. Both are expected to shake up the current meta significantly.</p>
      <h2>New Events</h2>
      <p>Multiple limited-time events will run during the update period, offering generous rewards including Primogems, Mora, and exclusive furniture for the Serenitea Pot.</p>
      <h2>Quality of Life Improvements</h2>
      <p>The development team has addressed several community-requested features, including improved artifact management and a new quick-swap party system.</p>
      <h2>Top Up for the Update</h2>
      <p>Make sure you have enough Genesis Crystals ready for the new banners. Visit our <strong>Genshin Impact</strong> page to top up instantly with crypto!</p>
    `,
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
    coverImage: "https://picsum.photos/seed/blog3/1200/600",
    content: `
      <h2>The Problem with Traditional Payments</h2>
      <p>Traditional payment methods come with high fees, slow processing times, and geographic restrictions that make cross-border gaming purchases frustrating.</p>
      <h2>How Crypto Solves This</h2>
      <p>Cryptocurrency eliminates intermediaries, reduces fees to near-zero, and enables instant global transactions. For gamers, this means:</p>
      <ul>
        <li>No more 3-5% credit card processing fees</li>
        <li>No geographic restrictions on purchases</li>
        <li>Instant delivery without waiting for bank confirmations</li>
        <li>Privacy — no need to share personal financial information</li>
      </ul>
      <h2>The Future is Now</h2>
      <p>Platforms like EZTopUp are already making crypto payments seamless for digital voucher buyers worldwide. As adoption grows, we expect to see more gaming platforms embrace cryptocurrency as a primary payment method.</p>
    `,
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
    coverImage: "https://picsum.photos/seed/blog4/1200/600",
    content: `
      <h2>1. Mobile Legends: Bang Bang</h2>
      <p>Still the king of mobile MOBAs in Southeast Asia, MLBB continues to dominate with regular updates and a thriving esports scene.</p>
      <h2>2. Genshin Impact</h2>
      <p>HoYoverse's open-world RPG remains a powerhouse, delivering console-quality experiences on mobile with each new update.</p>
      <h2>3. Honkai: Star Rail</h2>
      <p>The turn-based RPG from HoYoverse has carved out its own niche with stunning visuals and engaging story content.</p>
      <h2>4. Free Fire</h2>
      <p>Garena's battle royale remains one of the most accessible and popular mobile shooters worldwide.</p>
      <h2>5. PUBG Mobile</h2>
      <p>Continuing to evolve with new maps, modes, and collaborations, PUBG Mobile stays relevant in the competitive shooter space.</p>
    `,
  },
];

function getBlogPost(slug: string) {
  return blogPosts.find((p) => p.slug === slug);
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return { title: "Post Not Found" };
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: `${post.title} | EZTopUp Blog`,
      description: post.excerpt,
      images: [{ url: post.coverImage }],
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();
  return <BlogPostContent post={post} />;
}
