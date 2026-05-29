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
    "Buy digital vouchers and e-vouchers with crypto at eztopup.io. Secure payments, competitive prices, and fast delivery.",
  keywords: ["digital voucher", "e-voucher", "crypto", "marketplace", "game voucher", "eztopup"],
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "EZTopUp",
    title: "EZTopUp — Digital Voucher Marketplace",
    description:
      "Buy digital vouchers and e-vouchers with crypto at eztopup.io. Secure payments, competitive prices, and fast delivery.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="id" className="antialiased">
        <body className="min-h-[100dvh] flex flex-col bg-bg-primary text-text-primary">
          <AppProviders>{children}</AppProviders>
        </body>
      </html>
    </ClerkProvider>
  );
}
