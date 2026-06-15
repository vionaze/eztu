"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";

export type AppLocale = "id" | "en";

interface LocaleContextType {
  locale: AppLocale;
  languageTag: "id-ID" | "en-US";
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

function resolveLocale(languages: readonly string[] | undefined): AppLocale {
  const primaryLanguage = languages?.find(Boolean)?.toLowerCase() || "";

  if (
    primaryLanguage === "id" ||
    primaryLanguage.startsWith("id-") ||
    primaryLanguage === "ms" ||
    primaryLanguage.startsWith("ms-")
  ) {
    return "id";
  }

  return "en";
}

function getDeviceLocaleSnapshot(): AppLocale {
  if (typeof window === "undefined") {
    return "id" satisfies AppLocale;
  }

  return resolveLocale(window.navigator.languages);
}

function subscribeToDeviceLocale(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("languagechange", onStoreChange);

  return () => {
    window.removeEventListener("languagechange", onStoreChange);
  };
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(
    subscribeToDeviceLocale,
    getDeviceLocaleSnapshot,
    (): AppLocale => "id"
  );
  const languageTag = locale === "id" ? "id-ID" : "en-US";

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <LocaleContext.Provider value={{ locale, languageTag }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);

  if (context === undefined) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }

  return context;
}
