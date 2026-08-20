"use client";

import Link from "next/link";
import Image from "next/image";
import { useCurrency } from "@/context/CurrencyContext";
import type { Product } from "@/types/product";
import { Badge } from "@kupon/ui";
import { trackProductEvent } from "@/lib/product-analytics-client";

interface ProductCardProps {
  product: Product;
  size?: "default" | "large";
}

export default function ProductCard({ product, size = "default" }: ProductCardProps) {
  const { country, formatLocalPrice } = useCurrency();
  const variants = product.variants.filter(
    (variant) => variant.countryCode === country.supplierCode,
  );
  const hasMultipleVariants = variants.length > 1;

  const lowestPriceIDR = variants.length > 0
    ? Math.min(...variants.map((v) => v.priceIDR))
    : 0;
  
  const lowestPriceUSD = variants.length > 0
    ? Math.min(...variants.map((v) => v.priceUSD))
    : 0;

  if (variants.length === 0) return null;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group block rounded-xl md:rounded-2xl overflow-hidden bg-bg-card border border-white/[0.08] transition-all duration-[var(--duration-normal)] ease-[var(--ease-spring)] hover:border-accent/30 hover:shadow-[var(--shadow-glow)] hover:-translate-y-1"
      id={`product-card-${product.slug}`}
      onClick={() =>
        trackProductEvent({
          productId: product.id,
          eventType: "CARD_CLICK",
          countryCode: country.supplierCode,
        })
      }
    >
      {/* Image — shorter on mobile so cards stay compact */}
      <div
        className={`relative overflow-hidden ${
          size === "large"
            ? "aspect-[5/4] sm:aspect-[4/5] md:aspect-[3/4]"
            : "aspect-square sm:aspect-[4/5]"
        }`}
      >
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-cover transition-transform duration-500 ease-[var(--ease-spring)] group-hover:scale-105"
          sizes={size === "large" ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 768px) 45vw, 25vw"}
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/90 via-bg-primary/20 to-transparent" />

        {/* Featured badge */}
        {product.featured && (
          <div className="absolute top-2 left-2 md:top-3 md:left-3">
            <Badge variant="accent">Featured</Badge>
          </div>
        )}

        {/* Title overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-2.5 md:p-4">
          <h3 className="text-sm md:text-base font-semibold text-text-primary leading-tight line-clamp-2">
            {product.name}
          </h3>
          <p className="text-[11px] md:text-xs text-text-secondary mt-0.5 md:mt-1 line-clamp-1">
            {hasMultipleVariants
              ? `${variants.length} options`
              : variants[0]?.name || "1 option"}
          </p>
        </div>
      </div>

      {/* Recommended / sell price */}
      <div className="px-2.5 py-2 md:px-4 md:py-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] md:text-xs text-text-muted">
            {hasMultipleVariants ? "From" : "Price"}
          </p>
          <p className="text-xs md:text-sm font-semibold text-accent font-[family-name:var(--font-geist-mono)] truncate">
            {formatLocalPrice(lowestPriceIDR, lowestPriceUSD)}
          </p>
        </div>
        <div className="hidden sm:flex w-8 h-8 shrink-0 rounded-lg bg-accent/10 items-center justify-center text-accent opacity-0 group-hover:opacity-100 transition-opacity">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </Link>
  );
}
