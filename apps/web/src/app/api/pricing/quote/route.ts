import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@kupon/db";
import { MAX_SELF_SERVICE_QUANTITY } from "@/lib/checkout-limits";
import {
  createPricingQuote,
  getUsdIdrRate,
  signPricingQuote,
} from "@/lib/fx";
import { usdCentsToFixed } from "@/lib/money";
import {
  getFreshVariantPricing,
  SupplierPriceUnavailableError,
} from "@/lib/supplier-pricing";

export async function GET(request: NextRequest) {
  try {
    const variantId = request.nextUrl.searchParams.get("variantId")?.trim() || "";
    const quantity = Number(request.nextUrl.searchParams.get("quantity") || "1");
    const paymentMethod =
      request.nextUrl.searchParams.get("paymentMethod") === "crypto"
        ? "crypto"
        : "pakasir";
    if (
      !variantId ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_SELF_SERVICE_QUANTITY
    ) {
      return NextResponse.json({ error: "Invalid variant or quantity" }, { status: 400 });
    }

    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      select: {
        id: true,
        published: true,
        supplierSku: true,
        countryCode: true,
        nonCryptoMarkupBps: true,
        cryptoMarkupBps: true,
        product: { select: { published: true } },
      },
    });
    if (!variant || !variant.published || !variant.product.published) {
      return NextResponse.json({ error: "Product is not available" }, { status: 404 });
    }

    const freshPricing = await getFreshVariantPricing(variant, paymentMethod);
    const rate = await getUsdIdrRate();
    const quote = createPricingQuote({
      variantId: variant.id,
      quantity,
      paymentMethod,
      supplierCostIDR: freshPricing.supplierCostIDR,
      supplierCountryCode: freshPricing.countryCode,
      pricingMarkupBps: freshPricing.markupBps,
      unitPriceIDR: freshPricing.unitPriceIDR,
      rate,
    });

    return NextResponse.json(
      {
        quoteToken: signPricingQuote(quote),
        paymentMethod,
        unitPriceIDR: quote.unitPriceIDR,
        totalIDR: quote.totalIDR,
        totalUSDCents: quote.totalUSDCents,
        totalUSD: usdCentsToFixed(quote.totalUSDCents),
        usdIdrRate: quote.usdIdrRate,
        fxSource: quote.fxSource,
        quotedAt: quote.quotedAt,
        expiresAt: quote.expiresAt,
        supplierPriceVerifiedAt: freshPricing.verifiedAt.toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[Pricing Quote]", error);
    if (error instanceof SupplierPriceUnavailableError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Live exchange rate is temporarily unavailable. Please try again shortly." },
      { status: 503 }
    );
  }
}
