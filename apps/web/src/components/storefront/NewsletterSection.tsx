"use client";

import { FadeUp } from "@/components/motion/StaggerReveal";

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
      "Checkout is crypto-first through NOWPayments. The current setup supports USDT checkout and can be expanded to more currencies supported by the gateway.",
  },
  {
    question: "Why do you only ask for email?",
    answer:
      "These products are voucher-code based, so we do not need a game ID or server ID. The email is used to deliver the secure voucher link and receipt.",
  },
  {
    question: "What happens if my crypto payment is delayed?",
    answer:
      "Your order stays pending until the payment provider confirms it. Once confirmed, the order status syncs and fulfillment can continue.",
  },
  {
    question: "Can I get a refund after receiving a voucher?",
    answer:
      "Digital vouchers are generally final once delivered. If payment or delivery fails, contact support with your order number for review.",
  },
];

export default function FAQSection() {
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8">
        <FadeUp>
          <div className="liquid-glass rounded-2xl p-8 md:p-12 relative overflow-hidden">
            {/* Background glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-accent/[0.06] rounded-full blur-[100px]" />

            <div className="relative">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-text-primary">
                  FAQ
                </h2>
                <p className="text-sm md:text-base text-text-secondary mt-3 leading-relaxed">
                  Key details about buying e-vouchers with crypto on EZTopUp.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {faqs.map((faq) => (
                  <div
                    key={faq.question}
                    className="rounded-xl border border-white/[0.08] bg-bg-card/70 p-5 text-left"
                  >
                    <h3 className="text-sm font-semibold text-text-primary">
                      {faq.question}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                      {faq.answer}
                    </p>
                  </div>
                ))}
              </div>

              <p className="mt-8 text-center text-xs text-text-muted">
                Need help with an order? Keep your order number and recipient
                email ready when contacting support.
              </p>
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
