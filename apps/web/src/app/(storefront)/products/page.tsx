import type { Metadata } from "next";
import {
  getStorefrontCategories,
  getStorefrontProducts,
} from "@/lib/product-data";
import ProductsPageClient from "./ProductsPageClient";

export const metadata: Metadata = {
  title: "All Products",
  description:
    "Browse all digital vouchers and e-vouchers. Fast delivery with crypto payments.",
};

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const [products, categories] = await Promise.all([
    getStorefrontProducts(),
    getStorefrontCategories(),
  ]);

  return (
    <ProductsPageClient
      products={products}
      categories={categories}
    />
  );
}
