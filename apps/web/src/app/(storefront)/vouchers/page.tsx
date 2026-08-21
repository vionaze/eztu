import type { Metadata } from "next";
import {
  getStorefrontCategories,
  getStorefrontProducts,
} from "@/lib/product-data";
import VouchersPageClient from "./VouchersPageClient";

export const metadata: Metadata = {
  title: "All Vouchers",
  description:
    "Browse all game top-ups, digital vouchers, and e-vouchers. Fast delivery with local and crypto payments.",
};

export const dynamic = "force-dynamic";

export default async function VouchersPage() {
  const [products, categories] = await Promise.all([
    getStorefrontProducts(),
    getStorefrontCategories(),
  ]);

  return (
    <VouchersPageClient products={products} categories={categories} />
  );
}
