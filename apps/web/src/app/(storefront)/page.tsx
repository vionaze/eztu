import HeroSection from "@/components/storefront/HeroSection";
import FeaturesBar from "@/components/storefront/FeaturesBar";
import ProductGrid from "@/components/storefront/ProductGrid";
import VoucherCarousel from "@/components/storefront/VoucherCarousel";
import { getStorefrontProducts } from "@/lib/product-data";
import FAQSection from "@/components/storefront/NewsletterSection";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const products = await getStorefrontProducts();
  const featured = products.filter((p) => p.featured);
  const popular = featured.length > 0 ? featured : products;
  const voucherProducts = products;

  return (
    <>
      {/* Hero */}
      <HeroSection products={products} />

      {/* Trust/Features Bar — overlapping hero bottom */}
      <FeaturesBar />

      {/* Main content area */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-8">
        {/* Popular Products */}
        <ProductGrid
          title="Popular Products"
          products={popular}
          viewAllHref="/products"
        />

        {/* Vouchers Carousel */}
        <VoucherCarousel
          title="Game Vouchers"
          products={voucherProducts}
          viewAllHref="/vouchers"
        />
      </div>

      {/* FAQ */}
      <FAQSection />
    </>
  );
}
