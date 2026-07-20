"use client";

import { FadeUp } from "@/components/motion/StaggerReveal";
import {
  Lightning,
  ShieldCheck,
  CurrencyCircleDollar,
  Clock,
  Headset,
} from "@phosphor-icons/react";

const features = [
  {
    icon: Lightning,
    title: "Fast Delivery",
    description: "Codes after payment confirms",
  },
  {
    icon: ShieldCheck,
    title: "Secure Checkout",
    description: "Protected payment flow",
  },
  {
    icon: CurrencyCircleDollar,
    title: "USDT / USDC",
    description: "Stablecoin crypto checkout",
  },
  {
    icon: Clock,
    title: "Always Online",
    description: "Browse & order anytime",
  },
  {
    icon: Headset,
    title: "24/7 Support",
    description: "Help when you need it",
  },
];

export default function FeaturesBar() {
  return (
    <FadeUp>
      <section className="relative -mt-8 md:-mt-12 z-10">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8">
          <div className="liquid-glass rounded-2xl px-6 py-6 md:px-10 md:py-8">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 md:gap-4">
              {features.map((feature, i) => (
                <div
                  key={feature.title}
                  className={`flex items-start gap-3 ${
                    i === features.length - 1 ? "col-span-2 md:col-span-1" : ""
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <feature.icon size={20} className="text-accent" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">
                      {feature.title}
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </FadeUp>
  );
}
