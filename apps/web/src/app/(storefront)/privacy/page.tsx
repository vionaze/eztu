import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { FadeUp } from "@/components/motion/StaggerReveal";
import { Badge, Card } from "@kupon/ui";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How EZTopUp collects, uses, and protects personal data when you buy digital vouchers and use our services.",
};

const lastUpdated = "July 21, 2026";
const SUPPORT_EMAIL = "cs@eztopup.io";

const sections: { title: string; body: ReactNode }[] = [
  {
    title: "1. Who we are",
    body: (
      <p>
        This Privacy Policy explains how EZTopUp (&quot;we&quot;, &quot;us&quot;,
        &quot;our&quot;) operating at eztopup.io handles personal information when
        you browse the site, create an account, place an order, or contact support.
        For questions, email{" "}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="text-accent hover:text-accent-hover transition-colors"
        >
          {SUPPORT_EMAIL}
        </a>
        .
      </p>
    ),
  },
  {
    title: "2. Information we collect",
    body: (
      <>
        <p>Depending on how you use the Service, we may process:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <span className="text-text-primary font-medium">Account data</span>{" "}
            — name, email, profile image, and authentication identifiers from
            our sign-in provider (e.g. Clerk / Google or other methods you choose).
          </li>
          <li>
            <span className="text-text-primary font-medium">Order data</span>{" "}
            — products purchased, amounts, currency, order status, recipient
            email, and for direct top-ups any game User ID / Zone or server
            details you submit.
          </li>
          <li>
            <span className="text-text-primary font-medium">Payment data</span>{" "}
            — payment status, provider references, and crypto transaction
            metadata from payment partners. We do not store full card numbers;
            crypto wallet details are handled by the payment provider.
          </li>
          <li>
            <span className="text-text-primary font-medium">
              Technical &amp; security data
            </span>{" "}
            — IP address, browser type, device information, approximate
            location derived from IP, logs, and fraud-prevention signals.
          </li>
          <li>
            <span className="text-text-primary font-medium">
              Cookies &amp; similar technologies
            </span>{" "}
            — see Section 6 and our on-site cookie banner.
          </li>
          <li>
            <span className="text-text-primary font-medium">Support messages</span>{" "}
            — content you send to {SUPPORT_EMAIL} or other support channels.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "3. How we use information",
    body: (
      <>
        <p>We use personal data to:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Provide the storefront, accounts, checkout, and order history</li>
          <li>Process payments and fulfill vouchers or top-ups via suppliers</li>
          <li>Deliver voucher codes or status updates by email or secure link</li>
          <li>Prevent fraud, abuse, and security incidents</li>
          <li>Respond to support requests and improve the Service</li>
          <li>
            Comply with legal obligations and enforce our{" "}
            <Link href="/terms" className="text-accent hover:text-accent-hover">
              Terms of Service
            </Link>
          </li>
          <li>
            If you accept analytics/optional cookies, understand site usage in
            aggregate
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "4. Legal bases (where applicable)",
    body: (
      <p>
        Where data-protection laws require a legal basis (for example GDPR), we
        rely on: performance of a contract (orders and delivery), legitimate
        interests (security, fraud prevention, service improvement), consent
        (optional cookies/marketing where used), and legal obligation where we
        must retain or disclose records.
      </p>
    ),
  },
  {
    title: "5. Sharing with service providers",
    body: (
      <>
        <p>
          We share data with processors only as needed to run the Service, such
          as:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Authentication / identity (e.g. Clerk)</li>
          <li>Payment processors (e.g. crypto payment partners)</li>
          <li>Product suppliers for voucher issuance or top-up fulfillment</li>
          <li>Hosting, database, email, and operational tooling</li>
          <li>Security and anti-fraud tooling</li>
        </ul>
        <p>
          We do not sell your personal information. Providers may process data
          in other countries under their own security and contractual
          safeguards.
        </p>
      </>
    ),
  },
  {
    title: "6. Cookies and similar technologies",
    body: (
      <>
        <p>We use:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <span className="text-text-primary font-medium">Essential cookies</span>{" "}
            — required for login sessions, security, load balancing, and core
            checkout. These cannot be switched off via the banner without
            breaking the Service.
          </li>
          <li>
            <span className="text-text-primary font-medium">
              Optional cookies
            </span>{" "}
            — analytics or similar tools (when enabled) to understand traffic
            and improve the site. These load only if you choose{" "}
            <strong className="text-text-primary font-medium">Accept all</strong>{" "}
            on the cookie banner (or equivalent preference).
          </li>
        </ul>
        <p>
          You can change your choice later by clearing site data for eztopup.io
          or using browser controls. See also the cookie notice on first visit.
        </p>
      </>
    ),
  },
  {
    title: "7. Retention",
    body: (
      <p>
        We keep account and order records for as long as needed to provide the
        Service, handle disputes, prevent fraud, and meet accounting or legal
        requirements. Support emails and logs are retained for a reasonable
        period then deleted or anonymized when no longer needed.
      </p>
    ),
  },
  {
    title: "8. Security",
    body: (
      <p>
        We use industry-standard measures such as HTTPS, access controls, and
        monitoring. No method of transmission or storage is 100% secure; please
        protect your account credentials and treat voucher codes as sensitive.
      </p>
    ),
  },
  {
    title: "9. Your rights",
    body: (
      <>
        <p>
          Depending on your location, you may have rights to access, correct,
          delete, or export personal data, object to certain processing, or
          withdraw consent (for example optional cookies). To exercise rights,
          contact {SUPPORT_EMAIL}. We may need to verify your identity first.
        </p>
        <p>
          If you use a third-party login (e.g. Google), you may also manage some
          data directly with that provider.
        </p>
      </>
    ),
  },
  {
    title: "10. Children",
    body: (
      <p>
        The Service is not directed at children under 13 (or the minimum age in
        your country). If you believe we collected data from a child, contact us
        and we will take appropriate steps.
      </p>
    ),
  },
  {
    title: "11. International users",
    body: (
      <p>
        EZTopUp may be operated from and process data in jurisdictions other
        than yours. By using the Service you understand that your information
        may be transferred to countries with different data-protection laws.
      </p>
    ),
  },
  {
    title: "12. Changes",
    body: (
      <p>
        We may update this Policy from time to time. The &quot;Last
        updated&quot; date at the top will change when we do. Continued use of
        the Service after updates means you acknowledge the revised Policy.
      </p>
    ),
  },
  {
    title: "13. Contact",
    body: (
      <p>
        Privacy and data requests:{" "}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="text-accent hover:text-accent-hover transition-colors"
        >
          {SUPPORT_EMAIL}
        </a>
        . General support:{" "}
        <Link href="/contact" className="text-accent hover:text-accent-hover">
          Contact page
        </Link>
        .
      </p>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-[100dvh] pt-28 pb-20">
      <div className="max-w-[800px] mx-auto px-4 md:px-8">
        <FadeUp>
          <div className="mb-10">
            <Badge variant="muted" className="mb-4">
              Legal
            </Badge>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tighter text-text-primary">
              Privacy Policy
            </h1>
            <p className="text-sm text-text-muted mt-3">
              Last updated: {lastUpdated}
            </p>
            <p className="text-base text-text-secondary mt-4 leading-relaxed">
              This Policy describes how we handle personal data when you use
              EZTopUp. It works together with our Terms of Service and the
              cookie preferences you set on the site.
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
                Cookies in short:{" "}
              </span>
              Essential cookies always run so login and checkout work. Optional
              cookies (e.g. analytics) only run if you click{" "}
              <span className="text-text-primary font-medium">Accept all</span>{" "}
              on the cookie banner. You can review details in Section 6.
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
                <div className="text-sm text-text-secondary leading-relaxed space-y-3 [&_p]:text-sm [&_p]:leading-relaxed [&_li]:text-sm [&_li]:text-text-secondary">
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
              <Link href="/terms" className="text-accent hover:text-accent-hover">
                Terms of Service
              </Link>
              {" · "}
              <Link href="/contact" className="text-accent hover:text-accent-hover">
                Contact
              </Link>
            </p>
          </div>
        </FadeUp>
      </div>
    </div>
  );
}
