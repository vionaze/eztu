import type { Metadata } from "next";
import Link from "next/link";
import { FadeUp } from "@/components/motion/StaggerReveal";
import { Badge, Card } from "@kupon/ui";
import {
  EnvelopeSimple,
  Clock,
  ChatCircleDots,
  ArrowRight,
  CopySimple,
} from "@phosphor-icons/react/dist/ssr";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact EZTopUp customer support at cs@eztopup.io for order help, payments, and product questions.",
};

const SUPPORT_EMAIL = "cs@eztopup.io";
const MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("EZTopUp Support")}`;

const contactChannels = [
  {
    icon: EnvelopeSimple,
    title: "Email support",
    description: "Best for order issues, payment questions, and account help.",
    value: SUPPORT_EMAIL,
    href: MAILTO,
    cta: "Send email",
  },
  {
    icon: Clock,
    title: "Response time",
    description: "We aim to reply as soon as possible during support hours.",
    value: "Usually within 24 hours",
    href: null,
    cta: null,
  },
  {
    icon: ChatCircleDots,
    title: "What to include",
    description: "Share your order number, email used at checkout, and a short description.",
    value: "Order ID + screenshots if any",
    href: null,
    cta: null,
  },
];

export default function ContactPage() {
  return (
    <div className="min-h-[100dvh] pt-28 pb-20">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8">
        <FadeUp>
          <div className="mb-10 max-w-2xl">
            <Badge variant="muted" className="mb-4">
              Support
            </Badge>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tighter text-text-primary">
              Contact us
            </h1>
            <p className="text-base text-text-secondary mt-3 leading-relaxed">
              Need help with a purchase, voucher delivery, or crypto payment?
              Reach EZTopUp support by email — we will get back to you as soon
              as we can.
            </p>
          </div>
        </FadeUp>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 md:gap-8">
          {/* Primary CTA card */}
          <FadeUp delay={0.05} className="lg:col-span-3">
            <Card
              variant="default"
              padding="lg"
              className="relative overflow-hidden h-full border-accent/20"
            >
              <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-accent/[0.06] pointer-events-none hidden md:block" />
              <div className="relative space-y-6">
                <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                  <EnvelopeSimple size={24} className="text-accent" weight="duotone" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-semibold text-text-primary tracking-tight">
                    Customer support
                  </h2>
                  <p className="text-sm text-text-secondary mt-2 leading-relaxed max-w-[48ch]">
                    Email is our main support channel. Tap the address below to
                    open your mail app with our support inbox ready.
                  </p>
                </div>

                <a
                  href={MAILTO}
                  className="group flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 rounded-2xl bg-bg-secondary/80 border border-border hover:border-accent/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                      <EnvelopeSimple size={20} className="text-accent" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-text-muted uppercase tracking-wide">
                        Email
                      </p>
                      <p className="text-base md:text-lg font-semibold text-accent font-[family-name:var(--font-geist-mono)] truncate">
                        {SUPPORT_EMAIL}
                      </p>
                    </div>
                  </div>
                  <span className="sm:ml-auto inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-accent text-bg-primary text-sm font-medium shrink-0 group-hover:bg-accent-hover transition-colors">
                    Open mail app
                    <ArrowRight size={16} weight="bold" />
                  </span>
                </a>

                <p className="text-xs text-text-muted leading-relaxed">
                  Prefer to copy the address? Select{" "}
                  <span className="text-text-secondary font-[family-name:var(--font-geist-mono)]">
                    {SUPPORT_EMAIL}
                  </span>{" "}
                  or long-press on mobile.
                </p>
              </div>
            </Card>
          </FadeUp>

          {/* Side channels */}
          <div className="lg:col-span-2 space-y-4">
            {contactChannels.map((item, index) => (
              <FadeUp key={item.title} delay={0.08 + index * 0.04}>
                <Card variant="default" padding="md" className="h-full">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-xl bg-bg-elevated/60 border border-border flex items-center justify-center shrink-0">
                      <item.icon size={20} className="text-accent" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <h3 className="text-sm font-semibold text-text-primary">
                        {item.title}
                      </h3>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        {item.description}
                      </p>
                      <p className="text-sm font-medium text-text-primary pt-1">
                        {item.value}
                      </p>
                      {item.href && item.cta ? (
                        <a
                          href={item.href}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover transition-colors pt-1"
                        >
                          {item.cta}
                          <ArrowRight size={12} weight="bold" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                </Card>
              </FadeUp>
            ))}
          </div>
        </div>

        <FadeUp delay={0.2}>
          <Card variant="glass" padding="lg" className="mt-8 md:mt-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  Looking for orders instead?
                </h2>
                <p className="text-sm text-text-secondary mt-1 max-w-[48ch]">
                  Sign in to view purchase history, payment status, and voucher
                  delivery links.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <Link
                  href="/account/purchases"
                  className="inline-flex items-center justify-center h-10 px-5 rounded-xl bg-bg-card border border-border text-sm font-medium text-text-primary hover:border-accent/30 transition-colors"
                >
                  Purchase history
                </Link>
                <a
                  href={MAILTO}
                  className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-accent text-bg-primary text-sm font-medium hover:bg-accent-hover transition-colors"
                >
                  <CopySimple size={16} weight="bold" className="opacity-80" />
                  Email CS
                </a>
              </div>
            </div>
          </Card>
        </FadeUp>
      </div>
    </div>
  );
}
