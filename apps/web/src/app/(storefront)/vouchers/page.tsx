import type { Metadata } from "next";
import { getStorefrontProducts } from "@/lib/product-data";
import ProductCard from "@/components/storefront/ProductCard";
import { FadeUp, StaggerReveal, StaggerItem } from "@/components/motion/StaggerReveal";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";

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

        {vouchers.length > 0 ? (
          <StaggerReveal className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
            {vouchers.map((product) => (
              <StaggerItem key={product.id}>
                <ProductCard product={product} />
              </StaggerItem>
            ))}
          </StaggerReveal>
        ) : (
          <FadeUp>
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-bg-card">
                <MagnifyingGlass size={24} className="text-text-muted" />
              </div>
              <h2 className="mb-1 text-lg font-semibold text-text-primary">
                No vouchers available
              </h2>
              <p className="max-w-[35ch] text-sm text-text-secondary">
                Product data has not been imported yet. Check back shortly.
              </p>
            </div>
          </FadeUp>
        )}
      </div>
    </div>
  );
}
