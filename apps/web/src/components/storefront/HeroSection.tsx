"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@kupon/ui";
import { FadeUp } from "@/components/motion/StaggerReveal";
import { motion } from "framer-motion";
import { ArrowRight, Lightning } from "@phosphor-icons/react";
import type { Product } from "@/types/product";
import { useCurrency } from "@/context/CurrencyContext";
import { isProductAvailableInMarket } from "@/lib/product-availability";

const heroCards = [
  {
    name: "Binance Gift Card",
    productSlugs: ["binance-gift-card"],
    image: "/binance-gift-card.webp",
    className: "top-[7%] left-[8%] w-[124px] xl:w-[136px]",
    animation: { y: [0, -12, 0], duration: 4, delay: 0 },
  },
  {
    name: "Roblox",
    productSlugs: ["roblox-gift-card", "roblox"],
    image: "/roblox.png",
    className: "top-[3%] right-[8%] w-[122px] xl:w-[134px]",
    animation: { y: [0, 10, 0], duration: 5, delay: 0.5 },
  },
  {
    name: "PlayStation Store",
    productSlugs: ["playstation-store"],
    image: "/ps.png",
    className: "top-[35%] left-[35%] w-[128px] xl:w-[140px]",
    animation: { y: [0, -8, 0], duration: 4.5, delay: 1 },
  },
  {
    name: "Valorant",
    productSlugs: ["valorant"],
    image: "/valorant.webp",
    className: "bottom-[3%] left-[8%] w-[122px] xl:w-[134px]",
    animation: { y: [0, 14, 0], duration: 5.5, delay: 0.8 },
  },
  {
    name: "Mobile Legends",
    productSlugs: ["mobile-legends", "mobile-legends-global"],
    image: "/mlbb.webp",
    className: "bottom-[7%] right-[7%] w-[124px] xl:w-[136px]",
    animation: { y: [0, -10, 0], duration: 4.8, delay: 0.35 },
  },
];

export default function HeroSection({ products }: { products: Product[] }) {
  const router = useRouter();
  const { country } = useCurrency();
  const visibleHeroCards = heroCards.filter((card) => {
    return products.some(
      (product) =>
        card.productSlugs.includes(product.slug) &&
        isProductAvailableInMarket(product, country.supplierCode),
    );
  });

  const scrollToFaq = () => {
    if (typeof window === "undefined") return;
    if (window.location.pathname === "/") {
      document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    router.push("/#faq");
  };

  return (
    <section className="relative min-h-[640px] md:min-h-[680px] flex items-center overflow-hidden">
      {/* Background layers — heavy blurs only on md+ (mobile GPU killer) */}
      <div className="absolute inset-0">
        {/* Gradient base */}
        <div className="absolute inset-0 bg-gradient-to-br from-bg-primary via-bg-secondary to-bg-primary" />

        {/* Radial glow (desktop only) */}
        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[600px] h-[600px] bg-accent/[0.04] rounded-full blur-[120px] hidden md:block" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-accent/[0.03] rounded-full blur-[100px] hidden md:block" />

        {/* Grid pattern — lighter on mobile */}
        <div
          className="absolute inset-0 opacity-[0.02] md:opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative max-w-[1400px] mx-auto px-4 md:px-8 w-full pt-28 pb-16 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/* Left — Text */}
          <div className="space-y-5 md:space-y-6">
            <FadeUp>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20">
                <Lightning size={14} weight="fill" className="text-accent" />
                <span className="text-xs font-medium text-accent">Instant Delivery</span>
              </div>
            </FadeUp>

            <FadeUp delay={0.1}>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tighter leading-none text-text-primary">
                Digital vouchers
                <br />
                <span className="gradient-text">paid in crypto</span>
              </h1>
            </FadeUp>

            <FadeUp delay={0.2}>
              <p className="text-base md:text-lg text-text-secondary leading-relaxed max-w-[45ch]">
                EZTopUp sells digital vouchers and e-vouchers for global gaming
                platforms. Pay with crypto at eztopup.io and receive voucher
                codes fast.
              </p>
            </FadeUp>

            <FadeUp delay={0.3}>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={() => router.push("/products")}
                >
                  Explore Products
                  <ArrowRight size={16} weight="bold" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={scrollToFaq}
                >
                  How it works
                </Button>
              </div>
            </FadeUp>

            {/* Stats */}
            <FadeUp delay={0.4}>
              <div className="flex items-center gap-6 pt-2">
                <div>
                  <p className="text-2xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                    50K+
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">Transactions</p>
                </div>
                <div className="w-px h-10 bg-border" />
                <div>
                  <p className="text-2xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                    200+
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">Products</p>
                </div>
                <div className="w-px h-10 bg-border" />
                <div>
                  <p className="text-2xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                    24/7
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">Support</p>
                </div>
              </div>
            </FadeUp>
          </div>

          {/* Right — Visual (floating cards) */}
          <div className="relative hidden md:block">
            <div className="relative w-full aspect-square max-w-[420px] mx-auto">
              {/* Glow background */}
              <div className="absolute inset-0 bg-accent/[0.06] rounded-full blur-[80px]" />

              {/* Floating cards */}
              {visibleHeroCards.map((card) => (
                <motion.div
                  key={card.name}
                  className={`absolute ${card.className} rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-bg-card`}
                  animate={{ y: card.animation.y }}
                  transition={{
                    repeat: Infinity,
                    duration: card.animation.duration,
                    ease: "easeInOut",
                    delay: card.animation.delay,
                  }}
                >
                  <div className="relative aspect-[3/4]">
                    <Image
                      src={card.image}
                      alt={card.name}
                      fill
                      className="object-cover"
                      sizes="180px"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/80 via-bg-primary/10 to-transparent" />
                  </div>
                  <div className="p-3 bg-bg-card">
                    <p className="text-xs font-medium text-text-primary line-clamp-1">
                      {card.name}
                    </p>
                    <p className="text-[10px] text-accent font-[family-name:var(--font-geist-mono)]">
                      Available now
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
