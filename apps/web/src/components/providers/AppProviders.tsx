"use client";

import { CurrencyProvider } from "@/context/CurrencyContext";

export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CurrencyProvider>{children}</CurrencyProvider>;
}
