"use client";

import Link from "next/link";
import type { Product } from "@/types/product";
import ProductCard from "./ProductCard";
import { StaggerReveal, StaggerItem } from "@/components/motion/StaggerReveal";
import { ArrowRight } from "@phosphor-icons/react";

interface ProductGridProps {
  title: string;
  products: Product[];
  viewAllHref?: string;
  variant?: "asymmetric" | "uniform";
}

export default function ProductGrid({
  title,
  products,
  viewAllHref,
  variant = "asymmetric",
}: ProductGridProps) {
  if (products.length === 0) return null;

  return (
    <section className="py-12 md:py-16">
      {/* Section Header */}
      <div className="flex items-end justify-between mb-8">
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
      <StaggerReveal
        className={
          variant === "asymmetric"
            ? "grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5"
            : "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5"
        }
      >
        {products.map((product, i) => (
          <StaggerItem
            key={product.id}
            className={
              variant === "asymmetric" && i === 0
                ? "col-span-2 row-span-1 md:row-span-2"
                : ""
            }
          >
            <ProductCard
              product={product}
              size={variant === "asymmetric" && i === 0 ? "large" : "default"}
            />
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
