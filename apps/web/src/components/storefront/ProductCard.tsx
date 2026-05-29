"use client";

import Link from "next/link";
import Image from "next/image";
import { useCurrency } from "@/context/CurrencyContext";
import type { Product } from "@/types/product";
import { Badge } from "@kupon/ui";

interface ProductCardProps {
  product: Product;
  size?: "default" | "large";
}

export default function ProductCard({ product, size = "default" }: ProductCardProps) {
  const { formatLocalPrice } = useCurrency();

  const lowestPriceIDR = product.variants.length > 0
    ? Math.min(...product.variants.map((v) => v.priceIDR))
    : 0;
  
  const lowestPriceUSD = product.variants.length > 0
    ? Math.min(...product.variants.map((v) => v.priceUSD))
    : 0;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group block rounded-2xl overflow-hidden bg-bg-card border border-white/[0.08] transition-all duration-[var(--duration-normal)] ease-[var(--ease-spring)] hover:border-accent/30 hover:shadow-[var(--shadow-glow)] hover:-translate-y-1"
      id={`product-card-${product.slug}`}
    >
      {/* Image */}
      <div className={`relative overflow-hidden ${size === "large" ? "aspect-[3/4]" : "aspect-[4/5]"}`}>
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-cover transition-transform duration-500 ease-[var(--ease-spring)] group-hover:scale-105"
          sizes={size === "large" ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 768px) 50vw, 25vw"}
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/90 via-bg-primary/20 to-transparent" />

        {/* Featured badge */}
        {product.featured && (
          <div className="absolute top-3 left-3">
            <Badge variant="accent">Featured</Badge>
          </div>
        )}

        {/* Title overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="text-base font-semibold text-text-primary leading-tight">
            {product.name}
          </h3>
          <p className="text-xs text-text-secondary mt-1 line-clamp-1">
            {product.variants.length} options available
          </p>
        </div>
      </div>

      {/* Price */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-text-muted">Starting from</p>
          <p className="text-sm font-semibold text-accent font-[family-name:var(--font-geist-mono)]">
            {formatLocalPrice(lowestPriceIDR, lowestPriceUSD)}
          </p>
        </div>
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent opacity-0 group-hover:opacity-100 transition-opacity">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </Link>
  );
}
