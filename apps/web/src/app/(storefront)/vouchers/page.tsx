import type { Metadata } from "next";
import {
  getStorefrontCategories,
  getStorefrontProducts,
} from "@/lib/product-data";
import VouchersPageClient from "./VouchersPageClient";

export const metadata: Metadata = {
  title: "All Vouchers",
  description:
    "Shop game top-ups, gaming gift cards, and digital vouchers with secure checkout and fast delivery from EZTopUp.",
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
