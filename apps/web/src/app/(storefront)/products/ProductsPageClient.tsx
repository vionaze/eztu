"use client";

import { useState, useMemo } from "react";
import type { Product, Category } from "@/types/product";
import ProductCard from "@/components/storefront/ProductCard";
import { Input } from "@kupon/ui";
import { FadeUp } from "@/components/motion/StaggerReveal";
import { motion } from "framer-motion";
import { MagnifyingGlass, FunnelSimple } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/context/CurrencyContext";
import { isProductAvailableInMarket } from "@/lib/product-availability";

interface Props {
  products: Product[];
  categories: Category[];
}

export default function ProductsPageClient({ products, categories }: Props) {
  const { country } = useCurrency();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = products.filter((product) =>
      isProductAvailableInMarket(product, country.supplierCode),
    );

    if (activeCategory) {
      result = result.filter((p) => p.categoryId === activeCategory);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }

    return result;
  }, [products, activeCategory, search, country.supplierCode]);

  return (
    <div className="min-h-[100dvh] pt-28 pb-20">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8">
        {/* Page Header */}
        <FadeUp>
          <div className="mb-10">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tighter text-text-primary">
              All Products
            </h1>
            <p className="text-base text-text-secondary mt-3 max-w-[55ch] leading-relaxed">
              Browse our collection of digital vouchers and e-vouchers for
              gaming, platform credit, and entertainment.
            </p>
          </div>
        </FadeUp>

        {/* Filters Row */}
        <FadeUp delay={0.1}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
            {/* Search */}
            <div className="w-full sm:w-80">
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<MagnifyingGlass size={16} />}
              />
            </div>

            {/* Category Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar w-full sm:w-auto">
              <div className="flex items-center gap-1 text-text-muted mr-1">
                <FunnelSimple size={14} />
              </div>
              <button
                onClick={() => setActiveCategory(null)}
                className={cn(
                  "flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
                  !activeCategory
                    ? "bg-accent text-bg-primary"
                    : "bg-bg-card text-text-secondary hover:text-text-primary border border-border hover:border-accent/30"
                )}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() =>
                    setActiveCategory(activeCategory === cat.id ? null : cat.id)
                  }
                  className={cn(
                    "flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
                    activeCategory === cat.id
                      ? "bg-accent text-bg-primary"
                      : "bg-bg-card text-text-secondary hover:text-text-primary border border-border hover:border-accent/30"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </FadeUp>

        {/* Results count */}
        <p className="text-xs text-text-muted mb-6">
          Showing {filtered.length} of {products.length} products
        </p>

        {/* Product Grid */}
        {filtered.length > 0 ? (
          <motion.div
            layout
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5"
          >
            {filtered.map((product) => (
              <motion.div
                key={product.id}
                layout="position"
                transition={{ layout: { duration: 0.2 } }}
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <FadeUp>
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-bg-card border border-border flex items-center justify-center mb-4">
                <MagnifyingGlass size={24} className="text-text-muted" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-1">
                No products found
              </h3>
              <p className="text-sm text-text-secondary max-w-[35ch]">
                Try adjusting your search or filter to find what you&apos;re
                looking for.
              </p>
            </div>
          </FadeUp>
        )}
      </div>
    </div>
  );
}
