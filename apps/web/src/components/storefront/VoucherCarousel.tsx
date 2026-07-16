"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/types/product";
import { useCurrency } from "@/context/CurrencyContext";
import { FadeUp } from "@/components/motion/StaggerReveal";
import { ArrowRight, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Badge } from "@kupon/ui";

interface VoucherCarouselProps {
  title: string;
  products: Product[];
  viewAllHref?: string;
}

export default function VoucherCarousel({
  title,
  products,
  viewAllHref,
}: VoucherCarouselProps) {
  const { formatLocalPrice } = useCurrency();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    return () => el.removeEventListener("scroll", checkScroll);
  }, [checkScroll]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.7;
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  if (products.length === 0) return null;

  return (
    <section className="py-12 md:py-16">
      {/* Header */}
      <FadeUp>
        <div className="flex items-end justify-between mb-8">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-text-primary">
            {title}
          </h2>
          <div className="flex items-center gap-2">
            {/* Navigation arrows */}
            <button
              onClick={() => scroll("left")}
              disabled={!canScrollLeft}
              className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-accent/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Scroll left"
            >
              <CaretLeft size={16} />
            </button>
            <button
              onClick={() => scroll("right")}
              disabled={!canScrollRight}
              className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-accent/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Scroll right"
            >
              <CaretRight size={16} />
            </button>
            {viewAllHref && (
              <Link
                href={viewAllHref}
                className="hidden sm:flex items-center gap-1.5 ml-2 text-sm font-medium text-text-secondary hover:text-accent transition-colors group"
              >
                View all
                <ArrowRight
                  size={14}
                  className="transition-transform group-hover:translate-x-1"
                />
              </Link>
            )}
          </div>
        </div>
      </FadeUp>

      {/* Carousel */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto hide-scrollbar scroll-smooth pb-2"
      >
        {products.map((product) => {
          const lowestPriceIDR = product.variants.length > 0
            ? Math.min(...product.variants.map((v) => v.priceIDR))
            : 0;
            
          const lowestPriceUSD = product.variants.length > 0
            ? Math.min(...product.variants.map((v) => v.priceUSD))
            : 0;

          return (
            <Link
              key={product.id}
              href={`/products/${product.slug}`}
              className="group flex-shrink-0 w-[140px] sm:w-[180px] md:w-[220px] rounded-xl md:rounded-2xl overflow-hidden bg-bg-card border border-white/[0.08] transition-all duration-[var(--duration-normal)] ease-[var(--ease-spring)] hover:border-accent/30 hover:shadow-[var(--shadow-glow)] hover:-translate-y-1"
            >
              <div className="relative aspect-square sm:aspect-[4/5] overflow-hidden">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 640px) 140px, (max-width: 768px) 180px, 220px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/80 via-transparent to-transparent" />
                {product.featured && (
                  <div className="absolute top-2 left-2 md:top-2.5 md:left-2.5">
                    <Badge variant="accent">Hot</Badge>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 p-2 md:p-3">
                  <h3 className="text-xs sm:text-sm font-semibold text-text-primary line-clamp-2">
                    {product.name}
                  </h3>
                </div>
              </div>
              <div className="px-2.5 py-2 md:px-3 md:py-2.5">
                <p className="text-[10px] md:text-xs text-text-muted">
                  {product.variants.length > 1 ? "From" : "Price"}
                </p>
                <p className="text-xs sm:text-sm font-semibold text-accent font-[family-name:var(--font-geist-mono)]">
                  {formatLocalPrice(lowestPriceIDR, lowestPriceUSD)}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
