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

export default async function VouchersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  const initialSearch = (Array.isArray(q) ? q[0] : q)?.trim().slice(0, 100) || "";
  const [products, categories] = await Promise.all([
    getStorefrontProducts(),
    getStorefrontCategories(),
  ]);

  return (
    <VouchersPageClient key={initialSearch} products={products} categories={categories} initialSearch={initialSearch} />
  );
}
