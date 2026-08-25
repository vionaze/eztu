"use client";

import Link from "next/link";
import type { Product } from "@/types/product";
import ProductCard from "./ProductCard";
import { StaggerReveal, StaggerItem } from "@/components/motion/StaggerReveal";
import { ArrowRight } from "@phosphor-icons/react";
import { useCurrency } from "@/context/CurrencyContext";
import { isProductAvailableInMarket } from "@/lib/product-availability";

interface ProductGridProps {
  title: string;
  products: Product[];
  viewAllHref?: string;
}

export default function ProductGrid({
  title,
  products,
  viewAllHref,
}: ProductGridProps) {
  const { country } = useCurrency();
  const visibleProducts = products.filter((product) =>
    isProductAvailableInMarket(product, country.supplierCode),
  );

  if (visibleProducts.length === 0) return null;

  return (
    <section className="py-10 md:py-12">
      {/* Section Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-text-primary">
            {title}
          </h2>
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-accent transition-colors group"
          >
            View all
            <ArrowRight
              size={14}
              className="transition-transform group-hover:translate-x-1"
            />
          </Link>
        )}
      </div>

      {/* Grid */}
      <StaggerReveal className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 md:gap-4">
        {visibleProducts.map((product) => (
          <StaggerItem key={product.id} className="min-w-0 w-full">
            <ProductCard product={product} size="compact" />
          </StaggerItem>
        ))}
      </StaggerReveal>

      {/* Mobile view all */}
      {viewAllHref && (
        <div className="sm:hidden mt-6 flex justify-center">
          <Link
            href={viewAllHref}
            className="flex items-center gap-1.5 text-sm font-medium text-accent"
          >
            View all
            <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </section>
  );
}
