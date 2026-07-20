import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { FadeUp } from "@/components/motion/StaggerReveal";
import { Badge, Card } from "@kupon/ui";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "EZTopUp Terms of Service for digital voucher and game top-up purchases, including delivery, completion, and support policies.",
};

const lastUpdated = "July 20, 2026";

const sections: { title: string; body: ReactNode }[] = [
  {
    title: "1. Acceptance of Terms",
    body: (
      <>
        <p>
          By accessing or using EZTopUp (eztopup.io) and related services
          (the &quot;Service&quot;), you agree to these Terms of Service
          (&quot;Terms&quot;). If you do not agree, do not use the Service.
        </p>
        <p>
          These Terms apply to all visitors, customers, and users who browse,
          register, purchase, or otherwise interact with the Service.
        </p>
      </>
    ),
  },
  {
    title: "2. Description of Service",
    body: (
      <>
        <p>
          EZTopUp is a digital marketplace for game vouchers, e-vouchers, and
          related digital products. We may offer crypto payment options and
          deliver product codes or fulfill top-ups through third-party
          suppliers and payment providers.
        </p>
        <p>
          Product availability, pricing, and delivery methods may change
          without prior notice. Displayed prices may be shown in local currency
          estimates and in USD for crypto checkout.
        </p>
      </>
    ),
  },
  {
    title: "3. Eligibility and Accounts",
    body: (
      <>
        <p>
          You must be able to form a binding contract in your jurisdiction and
          provide accurate information when creating an account or placing an
          order. You are responsible for safeguarding your login credentials
          and for activity under your account.
        </p>
        <p>
          We may suspend or terminate access if we reasonably believe an
          account is used for fraud, abuse, chargeback abuse, or violation of
          these Terms.
        </p>
      </>
    ),
  },
  {
    title: "4. Orders and Payments",
    body: (
      <>
        <p>
          When you place an order, you authorize payment of the stated amount
          through the selected payment method (including cryptocurrency via our
          payment partners). An order is only processed after payment is
          confirmed according to the payment provider&apos;s rules.
        </p>
        <p>
          Network fees, blockchain confirmation times, and payment provider
          delays are outside our direct control. Pending payments may expire if
          not completed within the displayed payment window.
        </p>
        <p>
          You are responsible for entering correct order details (including
          email, game User ID, Zone/Server ID, or other fields required for
          digital top-up). Incorrect details may result in delivery to the wrong
          account, which we may be unable to reverse.
        </p>
      </>
    ),
  },
  {
    title: "5. Voucher Delivery and Transaction Completion",
    body: (
      <div className="space-y-3">
        <p>
          For voucher products, after payment confirmation our systems request
          and issue voucher codes from our suppliers. Delivery may be provided
          by email, secure voucher link, and/or your purchase history page.
        </p>
        <div className="rounded-xl border border-accent/25 bg-accent/5 px-4 py-3 text-sm text-text-primary leading-relaxed">
          <p className="font-semibold text-accent mb-1.5">
            Important — finality of delivered voucher codes
          </p>
          <p className="text-text-secondary">
            Once you have received the voucher code(s) for an order, the
            transaction is considered complete and fulfilled. Our system obtains
            voucher codes directly from suppliers at the time of fulfillment.
            Because codes are issued and may be redeemable immediately by the
            holder, delivered codes generally cannot be cancelled, reversed, or
            reissued as unused stock.
          </p>
        </div>
        <p>
          You should store codes securely and redeem them according to the
          publisher&apos;s rules. Loss of a code after delivery due to user
          error, device issues, or sharing with third parties is not our
          responsibility.
        </p>
        <p>
          For direct top-up products (where value is credited to a game account
          rather than a code), fulfillment is considered complete when the
          supplier reports successful processing for the account details you
          provided.
        </p>
      </div>
    ),
  },
  {
    title: "6. System Errors and Remedies",
    body: (
      <>
        <p>
          If a problem is caused by our system or process error (for example,
          payment confirmed but no code or top-up delivered, or a verified
          technical failure on our side), we will review the case and provide a
          resolution consistent with these Terms and applicable operational
          policies.
        </p>
        <p>
          Remedies may include re-fulfillment, replacement where commercially
          reasonable, store credit, or refund of the paid amount, depending on
          supplier constraints, payment provider rules, and the facts of the
          case. We are not obligated to provide remedies beyond what is
          reasonable where the issue was caused by incorrect user input, third-party
          outages, delayed blockchain confirmations, or supplier failures outside
          our control—though we may still assist in good faith.
        </p>
        <p>
          To request a review, contact{" "}
          <a
            href="mailto:cs@eztopup.io"
            className="text-accent hover:text-accent-hover transition-colors"
          >
            cs@eztopup.io
          </a>{" "}
          with your order number, payment proof, and a clear description of the
          issue.
        </p>
      </>
    ),
  },
  {
    title: "7. Refunds and Cancellations",
    body: (
      <>
        <p>
          Digital goods are generally non-refundable once delivered. Refunds
          before delivery may be considered if payment failed, the order could
          not be fulfilled, or we cancel the order.
        </p>
        <p>
          Crypto refunds, if approved, may be subject to network fees and may
          differ from the original network path or asset depending on the payment
          provider. We do not guarantee exchange-rate recovery for currency
          fluctuations.
        </p>
      </>
    ),
  },
  {
    title: "8. Prohibited Use",
    body: (
      <>
        <p>You agree not to:</p>
        <ul className="list-disc pl-5 space-y-1.5 text-text-secondary">
          <li>Use the Service for fraud, money laundering, or illegal activity</li>
          <li>Attempt to exploit pricing, checkout, or fulfillment systems</li>
          <li>Resell products in violation of publisher or supplier rules</li>
          <li>Interfere with security, rate limits, or other users&apos; access</li>
          <li>Provide false information or impersonate others</li>
        </ul>
      </>
    ),
  },
  {
    title: "9. Third-Party Services",
    body: (
      <p>
        Payments, authentication, email delivery, and product fulfillment may
        involve third parties (payment processors, identity providers, suppliers,
        hosting, and messaging tools). Their terms and privacy practices apply to
        their services. We are not responsible for outages or policy changes by
        third parties, but we will take reasonable steps to keep the Service
        operational.
      </p>
    ),
  },
  {
    title: "10. Intellectual Property",
    body: (
      <p>
        EZTopUp branding, site design, and original content are owned by us or
        our licensors. Game names, logos, and product marks belong to their
        respective owners and are used for identification of digital goods only.
        No endorsement by those publishers is implied unless stated.
      </p>
    ),
  },
  {
    title: "11. Disclaimer of Warranties",
    body: (
      <p>
        The Service is provided on an &quot;as is&quot; and &quot;as
        available&quot; basis. To the fullest extent permitted by law, we
        disclaim warranties of merchantability, fitness for a particular purpose,
        and non-infringement. We do not warrant uninterrupted or error-free
        operation.
      </p>
    ),
  },
  {
    title: "12. Limitation of Liability",
    body: (
      <p>
        To the fullest extent permitted by law, EZTopUp and its operators shall
        not be liable for indirect, incidental, special, consequential, or
        punitive damages, or for lost profits, data, or goodwill. Our aggregate
        liability for any claim related to an order shall not exceed the amount
        you paid for that order.
      </p>
    ),
  },
  {
    title: "13. Changes to Terms",
    body: (
      <p>
        We may update these Terms from time to time. Continued use of the Service
        after changes become effective constitutes acceptance of the updated
        Terms. Material changes may be highlighted on the site or during
        checkout/login where practical.
      </p>
    ),
  },
  {
    title: "14. Contact",
    body: (
      <p>
        Questions about these Terms or support for orders:{" "}
        <a
          href="mailto:cs@eztopup.io"
          className="text-accent hover:text-accent-hover transition-colors"
        >
          cs@eztopup.io
        </a>
        . You may also visit our{" "}
        <Link href="/contact" className="text-accent hover:text-accent-hover transition-colors">
          Contact
        </Link>{" "}
        page.
      </p>
    ),
  },
];

export default function TermsOfServicePage() {
  return (
    <div className="min-h-[100dvh] pt-28 pb-20">
      <div className="max-w-[800px] mx-auto px-4 md:px-8">
        <FadeUp>
          <div className="mb-10">
            <Badge variant="muted" className="mb-4">
              Legal
            </Badge>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tighter text-text-primary">
              Terms of Service
            </h1>
            <p className="text-sm text-text-muted mt-3">
              Last updated: {lastUpdated}
            </p>
            <p className="text-base text-text-secondary mt-4 leading-relaxed">
              Please read these Terms carefully before using EZTopUp. By creating
              an account or completing a purchase, you acknowledge that you
              understand and agree to them.
            </p>
          </div>
        </FadeUp>

        <FadeUp delay={0.05}>
          <Card
            variant="default"
            padding="md"
            className="mb-8 border-accent/20 bg-accent/[0.04]"
          >
            <p className="text-sm text-text-secondary leading-relaxed">
              <span className="font-semibold text-text-primary">
                Summary for voucher orders:{" "}
              </span>
              After you receive your voucher code, the sale is final because
              codes are sourced live from our suppliers. If a verified system
              error on our side prevents proper fulfillment, we will work with
              you on a resolution under Section 6.
            </p>
          </Card>
        </FadeUp>

        <div className="space-y-8">
          {sections.map((section, index) => (
            <FadeUp key={section.title} delay={Math.min(0.04 * index, 0.24)}>
              <section className="space-y-3">
                <h2 className="text-lg md:text-xl font-semibold text-text-primary tracking-tight">
                  {section.title}
                </h2>
                <div className="text-sm text-text-secondary leading-relaxed space-y-3 [&_p]:text-sm [&_p]:leading-relaxed">
                  {section.body}
                </div>
              </section>
            </FadeUp>
          ))}
        </div>

        <FadeUp delay={0.15}>
          <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <p className="text-xs text-text-muted">
              Related:{" "}
              <Link href="/contact" className="text-accent hover:text-accent-hover">
                Contact
              </Link>
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center h-10 px-5 rounded-xl bg-accent text-bg-primary text-sm font-medium hover:bg-accent-hover transition-colors"
            >
              Back to login
            </Link>
          </div>
        </FadeUp>
      </div>
    </div>
  );
}
