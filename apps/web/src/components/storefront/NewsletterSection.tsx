"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CaretDown } from "@phosphor-icons/react";
import { FadeUp } from "@/components/motion/StaggerReveal";
import { cn } from "@/lib/utils";
import Link from "next/link";

const faqs = [
  {
    question: "What does EZTopUp sell?",
    answer:
      "EZTopUp sells digital vouchers and e-vouchers for gaming platforms, store credit, and digital entertainment products.",
  },
  {
    question: "How do I receive my voucher?",
    answer:
      "After checkout and payment confirmation, a secure voucher link is sent to the recipient email you enter on the product page.",
  },
  {
    question: "Which payment methods are supported?",
    answer:
      "Checkout is crypto-first. Supported assets depend on the active payment gateway (e.g. USDT and other crypto options when configured).",
  },
  {
    question: "Why do you only ask for email?",
    answer:
      "Most products are voucher-code based, so we do not need a game ID. The email is used to deliver the secure voucher link and receipt. Direct top-up products may also ask for User ID / Zone.",
  },
  {
    question: "What happens if my crypto payment is delayed?",
    answer:
      "Your order stays pending until the payment provider confirms it. Once confirmed, the order status syncs and fulfillment continues.",
  },
  {
    question: "Can I get a refund after receiving a voucher?",
    answer:
      "Digital vouchers are generally final once delivered. If payment or delivery fails, contact support with your order number for review.",
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex((current) => (current === index ? null : index));
  };

  return (
    <section id="faq" className="py-12 md:py-16 scroll-mt-24 md:scroll-mt-28">
      <div className="max-w-[720px] mx-auto px-4 md:px-8">
        <FadeUp>
          <div className="text-center mb-6">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-text-primary">
              FAQ
            </h2>
            <p className="text-xs md:text-sm text-text-secondary mt-1.5">
              Tap a question to show the answer.
            </p>
          </div>
        </FadeUp>

        <FadeUp delay={0.05}>
          <div className="rounded-2xl border border-white/[0.08] bg-bg-card/60 overflow-hidden divide-y divide-white/[0.06]">
            {faqs.map((faq, index) => {
              const isOpen = openIndex === index;

              return (
                <div key={faq.question} className="bg-transparent">
                  <button
                    type="button"
                    onClick={() => toggle(index)}
                    aria-expanded={isOpen}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 md:px-5 md:py-3.5 text-left",
                      "hover:bg-white/[0.03] transition-colors cursor-pointer"
                    )}
                  >
                    <span className="flex-1 text-sm font-medium text-text-primary leading-snug">
                      {faq.question}
                    </span>
                    <motion.span
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="shrink-0 text-text-muted"
                    >
                      <CaretDown size={16} weight="bold" />
                    </motion.span>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{
                          height: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
                          opacity: { duration: 0.2 },
                        }}
                        className="overflow-hidden"
                      >
                        <p className="px-4 pt-3 pb-3.5 md:px-5 md:pt-3.5 md:pb-4 text-sm leading-relaxed text-text-secondary">
                          {faq.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </FadeUp>

        <p className="mt-5 text-center text-xs text-text-muted">
          Need help?{" "}
          <Link
            href="/contact"
            className="text-accent hover:text-accent-hover transition-colors"
          >
            Contact support
          </Link>
          {" · "}
          keep your order number ready.
        </p>
      </div>
    </section>
  );
}
