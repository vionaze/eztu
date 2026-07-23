import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getStorefrontProductBySlug,
  getStorefrontProducts,
} from "@/lib/product-data";
import ProductDetailClient from "./ProductDetailClient";

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getStorefrontProductBySlug(slug);
  if (!product) return { title: "Product Not Found" };

  return {
    title: product.name,
    description: product.description,
    openGraph: {
      title: `${product.name} | EZTopUp`,
      description: product.description,
      images: [{ url: product.image }],
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const product = await getStorefrontProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const products = await getStorefrontProducts();
  const related = products
    .filter(
      (p) =>
        p.id !== product.id &&
        p.published &&
        product.categoryId != null &&
        p.categoryId === product.categoryId
    )
    .slice(0, 4);

  return <ProductDetailClient product={product} relatedProducts={related} />;
}
