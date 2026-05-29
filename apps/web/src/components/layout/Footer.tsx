import Link from "next/link";
import Image from "next/image";
import {
  EnvelopeSimple,
  TwitterLogo,
  DiscordLogo,
  TelegramLogo,
} from "@phosphor-icons/react/dist/ssr";

const footerLinks = {
  products: [
    { label: "Vouchers", href: "/vouchers" },
    { label: "All Products", href: "/products" },
  ],
  company: [
    { label: "About Us", href: "/" },
    { label: "Blog", href: "/blog" },
    { label: "Contact", href: "/" },
  ],
  support: [
    { label: "FAQ", href: "/" },
    { label: "Terms of Service", href: "/" },
    { label: "Privacy Policy", href: "/" },
  ],
};

const socialLinks = [
  { icon: TwitterLogo, href: "#", label: "Twitter" },
  { icon: DiscordLogo, href: "#", label: "Discord" },
  { icon: TelegramLogo, href: "#", label: "Telegram" },
  { icon: EnvelopeSimple, href: "#", label: "Email" },
];

export default function Footer() {
  return (
    <footer className="border-t border-border bg-bg-secondary">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8">
          {/* Brand */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="relative h-16 w-64 sm:w-72 transition-transform duration-300 group-hover:scale-[1.03]">
                <Image
                  src="/logo.png"
                  alt="EZTopUp"
                  fill
                  className="object-contain object-left"
                  sizes="188px"
                />
              </div>
            </Link>
            <p className="text-sm text-text-secondary leading-relaxed max-w-[35ch]">
              EZTopUp is a digital voucher and e-voucher marketplace at
              eztopup.io. Buy securely with crypto and receive voucher codes
              fast.
            </p>
            {/* Social */}
            <div className="flex items-center gap-2 pt-2">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-text-muted hover:text-accent hover:bg-white/5 transition-all"
                  aria-label={social.label}
                >
                  <social.icon size={18} />
                </a>
              ))}
            </div>
          </div>

          {/* Products */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-text-primary tracking-wide uppercase">
              Products
            </h4>
            <ul className="space-y-2.5">
              {footerLinks.products.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-text-primary tracking-wide uppercase">
              Company
            </h4>
            <ul className="space-y-2.5">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-text-primary tracking-wide uppercase">
              Support
            </h4>
            <ul className="space-y-2.5">
              {footerLinks.support.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-muted">
            &copy; {new Date().getFullYear()} EZTopUp. All rights reserved.
          </p>
          <div className="flex items-center gap-1 text-xs text-text-muted">
            <span>Payments powered by</span>
            <a
              href="https://nowpayments.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-accent-hover transition-colors font-medium"
            >
              NOWPayments
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
