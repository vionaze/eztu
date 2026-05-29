import type { Metadata } from "next";
import { getStorefrontProducts } from "@/lib/product-data";
import ProductCard from "@/components/storefront/ProductCard";
import { FadeUp, StaggerReveal, StaggerItem } from "@/components/motion/StaggerReveal";

export const metadata: Metadata = {
  title: "Digital Vouchers",
  description:
    "Buy digital vouchers and e-vouchers for gaming platforms. Fast delivery with crypto payments.",
};

export const dynamic = "force-dynamic";

export default async function VouchersPage() {
  const vouchers = await getStorefrontProducts();

  return (
    <div className="min-h-[100dvh] pt-28 pb-20">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8">
        <FadeUp>
          <div className="mb-10">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tighter text-text-primary">
              Digital Vouchers
            </h1>
            <p className="text-base text-text-secondary mt-3 max-w-[55ch] leading-relaxed">
              Buy e-voucher codes for gaming, platform credit, and digital
              entertainment. Crypto checkout available.
            </p>
          </div>
        </FadeUp>

        <StaggerReveal className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
          {vouchers.map((product) => (
            <StaggerItem key={product.id}>
              <ProductCard product={product} />
            </StaggerItem>
          ))}
        </StaggerReveal>
      </div>
    </div>
  );
}
