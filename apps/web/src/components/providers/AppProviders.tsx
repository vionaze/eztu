"use client";

import { CurrencyProvider } from "@/context/CurrencyContext";
import { LocaleProvider } from "@/context/LocaleContext";

export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LocaleProvider>
      <CurrencyProvider>{children}</CurrencyProvider>
    </LocaleProvider>
  );
}
