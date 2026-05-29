"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuth, useClerk } from "@clerk/nextjs";
import type { Product } from "@/types/product";
import { formatPrice, cn } from "@/lib/utils";
import { useCurrency } from "@/context/CurrencyContext";
import { Badge, Button, Card, Input } from "@kupon/ui";
import ProductCard from "@/components/storefront/ProductCard";
import { FadeUp, StaggerReveal, StaggerItem } from "@/components/motion/StaggerReveal";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Lightning,
  ShieldCheck,
  Clock,
  CurrencyBtc,
  Check,
  User,
} from "@phosphor-icons/react";

interface Props {
  product: Product;
  relatedProducts: Product[];
}

export default function ProductDetailClient({ product, relatedProducts }: Props) {
  const router = useRouter();
  const { formatLocalPrice, country } = useCurrency();
  const { isLoaded, isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  
  const [selectedVariant, setSelectedVariant] = useState(
    product.variants[0]?.id || ""
  );
  const [email, setEmail] = useState("");

  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const variant = product.variants.find((v) => v.id === selectedVariant);

  const handleCheckout = async () => {
    if (!variant || !email.trim()) return;

    if (!isLoaded) return;

    if (!isSignedIn) {
      openSignIn();
      return;
    }

    setIsCheckingOut(true);

    try {
      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: product.id,
          variantId: variant.id,
          email,
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        alert(data.error || "Failed to create order");
        setIsCheckingOut(false);
        return;
      }

      // Redirect to payment URL or success page
      router.push(data.paymentUrl);
    } catch (error) {
      console.error("[Checkout]", error);
      alert("Failed to checkout. Please try again.");
      setIsCheckingOut(false);
    }
  };

  const totalIDR = variant ? Math.max(0, variant.priceIDR) : 0;
  const totalUSD = variant ? Math.max(0, variant.priceUSD) : 0;
  const isFree = totalUSD <= 0;

  return (
    <div className="min-h-[100dvh] pt-24 pb-20">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8">
        {/* Breadcrumb */}
        <FadeUp>
          <div className="mb-8">
            <Link
              href="/products"
              className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent transition-colors group"
            >
              <ArrowLeft
                size={14}
                className="transition-transform group-hover:-translate-x-1"
              />
              Back to products
            </Link>
          </div>
        </FadeUp>

        {/* Main Content — Asymmetric Layout */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 md:gap-12">
          {/* Left — Product Image (60%) */}
          <FadeUp className="md:col-span-3">
            <div className="relative aspect-[4/5] md:aspect-[3/4] rounded-2xl overflow-hidden border border-white/[0.08]">
              <Image
                src={product.image}
                alt={product.name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 60vw"
                priority
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/60 via-transparent to-transparent" />

              {/* Badge */}
              {product.featured && (
                <div className="absolute top-4 left-4">
                  <Badge variant="accent">Featured</Badge>
                </div>
              )}
            </div>
          </FadeUp>

          {/* Right — Product Details (40%) */}
          <div className="md:col-span-2 space-y-6">
            <FadeUp delay={0.1}>
              <div className="space-y-3">
                <Badge variant="muted">
                  {product.variants.length} variants
                </Badge>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-text-primary">
                  {product.name}
                </h1>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {product.description}
                </p>
              </div>
            </FadeUp>

            {/* Variant Selection */}
            <FadeUp delay={0.2}>
              <div className="space-y-3">
                <label className="block text-sm font-medium text-text-secondary">
                  Select package
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {product.variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => {
                        setSelectedVariant(v.id);
                      }}
                      className={cn(
                        "relative p-3 rounded-xl border text-left transition-all cursor-pointer",
                        "hover:border-accent/40",
                        selectedVariant === v.id
                          ? "border-accent bg-accent/5 shadow-[var(--shadow-glow)]"
                          : "border-border bg-bg-card hover:bg-bg-elevated/50"
                      )}
                    >
                      {selectedVariant === v.id && (
                        <motion.div
                          layoutId="variant-check"
                          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent flex items-center justify-center"
                          transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        >
                          <Check size={12} weight="bold" className="text-bg-primary" />
                        </motion.div>
                      )}
                      <p className="text-sm font-medium text-text-primary pr-6">
                        {v.name}
                      </p>
                      <p className="text-xs font-semibold text-accent mt-1 font-[family-name:var(--font-geist-mono)]">
                        {formatLocalPrice(v.priceIDR, v.priceUSD)}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </FadeUp>

            {/* Recipient Email */}
            <FadeUp delay={0.3}>
              <div className="space-y-3">
                <Input
                  label="Recipient Email"
                  type="email"
                  placeholder="recipient@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </FadeUp>

            {/* Price Summary */}
            <FadeUp delay={0.35}>
              <Card variant="glass" padding="md">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-text-secondary">Selected</span>
                  <span className="text-sm font-medium text-text-primary">
                    {variant?.name || "—"}
                  </span>
                </div>
                
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-text-secondary">Subtotal</span>
                  <span className="text-sm font-medium text-text-primary font-[family-name:var(--font-geist-mono)]">
                    {variant ? formatLocalPrice(variant.priceIDR, variant.priceUSD) : "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between mt-2 mb-1">
                  <span className="text-sm text-text-secondary">Total Price</span>
                  <span className="text-xl font-bold text-accent font-[family-name:var(--font-geist-mono)]">
                    {formatLocalPrice(totalIDR, totalUSD)}
                  </span>
                </div>
                {variant && country.code !== "US" && (
                  <p className="text-right text-xs text-text-muted font-[family-name:var(--font-geist-mono)]">
                    ≈ {formatPrice(totalUSD, "USD")}
                  </p>
                )}
              </Card>
            </FadeUp>

            {/* CTA */}
            <FadeUp delay={0.4}>
              <Button
                size="lg"
                className="w-full"
                onClick={handleCheckout}
                disabled={!isLoaded || !selectedVariant || !email.trim() || isCheckingOut}
              >
                {isCheckingOut ? (
                  <>Processing...</>
                ) : !isLoaded ? (
                  <>Loading...</>
                ) : !isSignedIn ? (
                  <>
                    <User size={18} weight="bold" />
                    Login to Pay
                  </>
                ) : isFree ? (
                  <>
                    <Check size={18} weight="bold" />
                    Claim for Free
                  </>
                ) : (
                  <>
                    <CurrencyBtc size={18} weight="bold" />
                    Pay with Crypto
                  </>
                )}
              </Button>
              {!isFree && (
                <p className="text-center text-xs text-text-muted mt-2">
                  Powered by NOWPayments · USDT checkout supported
                </p>
              )}
            </FadeUp>

            {/* Trust signals */}
            <FadeUp delay={0.45}>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Lightning, label: "Instant" },
                  { icon: ShieldCheck, label: "Secure" },
                  { icon: Clock, label: "24/7" },
                ].map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-bg-card/50 border border-border"
                  >
                    <Icon size={18} className="text-accent" />
                    <span className="text-xs text-text-muted">{label}</span>
                  </div>
                ))}
              </div>
            </FadeUp>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <section className="mt-20">
            <FadeUp>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-text-primary mb-8">
                Related Products
              </h2>
            </FadeUp>
            <StaggerReveal className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
              {relatedProducts.map((p) => (
                <StaggerItem key={p.id}>
                  <ProductCard product={p} />
                </StaggerItem>
              ))}
            </StaggerReveal>
          </section>
        )}
      </div>
    </div>
  );
}
