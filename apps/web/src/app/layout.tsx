import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import AppProviders from "@/components/providers/AppProviders";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "EZTopUp — Digital Voucher Marketplace",
    template: "%s | EZTopUp",
  },
  description:
    "Shop digital vouchers, game top-ups, and e-vouchers at EZTopUp. Enjoy secure checkout, competitive prices, and fast digital delivery.",
  keywords: ["digital voucher", "e-voucher", "game top-up", "marketplace", "game voucher", "eztopup"],
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "EZTopUp",
    title: "EZTopUp — Digital Voucher Marketplace",
    description:
      "Shop digital vouchers, game top-ups, and e-vouchers at EZTopUp. Enjoy secure checkout, competitive prices, and fast digital delivery.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider signInUrl="/login" signUpUrl="/signup">
      <html lang="id" className="antialiased">
        <body className="min-h-[100dvh] flex flex-col bg-bg-primary text-text-primary">
          <AppProviders>{children}</AppProviders>
        </body>
      </html>
    </ClerkProvider>
  );
}
