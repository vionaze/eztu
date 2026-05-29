"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { products, categories } from "@/lib/dummy-data";
import { formatPrice } from "@/lib/utils";
import { Badge, Button, Card, Input } from "@kupon/ui";
import { FadeUp } from "@/components/motion/StaggerReveal";
import {
  Plus,
  MagnifyingGlass,
  PencilSimple,
  Trash,
  Eye,
} from "@phosphor-icons/react";

export default function AdminProductsPage() {
  const [search, setSearch] = useState("");

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <FadeUp>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="w-full sm:w-72">
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<MagnifyingGlass size={16} />}
            />
          </div>
          <Link href="/admin/products/new">
            <Button>
              <Plus size={16} weight="bold" />
              Add Product
            </Button>
          </Link>
        </div>
      </FadeUp>

      {/* Products Table */}
      <FadeUp delay={0.1}>
        <Card variant="default" padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Price Range
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Variants
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((product) => {
                  const category = categories.find(
                    (c) => c.id === product.categoryId
                  );
                  const minPrice = Math.min(
                    ...product.variants.map((v) => v.priceIDR)
                  );
                  const maxPrice = Math.max(
                    ...product.variants.map((v) => v.priceIDR)
                  );

                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Product */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-border flex-shrink-0 relative">
                            <Image
                              src={product.image}
                              alt={product.name}
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-text-primary">
                              {product.name}
                            </p>
                            <p className="text-xs text-text-muted">
                              {product.slug}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-text-secondary">
                          {category?.name || "—"}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-[family-name:var(--font-geist-mono)] text-text-primary">
                          {formatPrice(minPrice)} – {formatPrice(maxPrice)}
                        </span>
                      </td>

                      {/* Variants */}
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-text-secondary">
                          {product.variants.length}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <Badge
                          variant={product.published ? "accent" : "muted"}
                        >
                          {product.published ? "Published" : "Draft"}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/products/${product.slug}`}
                            target="_blank"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/5 transition-all"
                            title="View"
                          >
                            <Eye size={16} />
                          </Link>
                          <Link
                            href={`/admin/products/${product.id}/edit`}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-accent hover:bg-accent/5 transition-all"
                            title="Edit"
                          >
                            <PencilSimple size={16} />
                          </Link>
                          <button
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-400/5 transition-all cursor-pointer"
                            title="Delete"
                          >
                            <Trash size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-sm text-text-muted">No products found.</p>
            </div>
          )}
        </Card>
      </FadeUp>
    </div>
  );
}
