"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";
import {
  COUNTRIES,
  Country,
  DEFAULT_COUNTRY,
  findCountryByRegion,
  resolveCountryByRegion,
} from "@/lib/currencies";

interface CurrencyContextType {
  country: Country;
  setCountry: (country: Country) => void;
  formatLocalPrice: (priceIDR: number, priceUSD: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);
// Versioned so visitors previously defaulted to Indonesia are detected again
// and correctly moved to Global when their region is unsupported.
const COUNTRY_STORAGE_KEY = "kupon_country_v2";
const COUNTRY_CHANGE_EVENT = "kupon-country-change";

function countryFromCode(code: string | null) {
  return COUNTRIES.find((country) => country.code === code) || DEFAULT_COUNTRY;
}

function subscribeToCountryChanges(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("storage", onStoreChange);
  window.addEventListener(COUNTRY_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(COUNTRY_CHANGE_EVENT, onStoreChange);
  };
}

function getCountrySnapshot() {
  if (typeof window === "undefined") {
    return DEFAULT_COUNTRY.code;
  }

  return localStorage.getItem(COUNTRY_STORAGE_KEY) || DEFAULT_COUNTRY.code;
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const countryCode = useSyncExternalStore(
    subscribeToCountryChanges,
    getCountrySnapshot,
    () => DEFAULT_COUNTRY.code
  );
  const country = countryFromCode(countryCode);

  useEffect(() => {
    if (localStorage.getItem(COUNTRY_STORAGE_KEY)) return;
    const controller = new AbortController();
    const localeRegion = navigator.languages
      .map((language) => language.split("-")[1])
      .find(Boolean);
    const localeCountry = findCountryByRegion(localeRegion);

    fetch("/api/location", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { countryCode?: string | null };
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        const detected = data?.countryCode
          ? resolveCountryByRegion(data.countryCode)
          : localeCountry || DEFAULT_COUNTRY;
        localStorage.setItem(COUNTRY_STORAGE_KEY, detected.code);
        window.dispatchEvent(new Event(COUNTRY_CHANGE_EVENT));
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        const detected = localeCountry || DEFAULT_COUNTRY;
        localStorage.setItem(COUNTRY_STORAGE_KEY, detected.code);
        window.dispatchEvent(new Event(COUNTRY_CHANGE_EVENT));
      });

    return () => controller.abort();
  }, []);

  const setCountry = useCallback((newCountry: Country) => {
    localStorage.setItem(COUNTRY_STORAGE_KEY, newCountry.code);
    window.dispatchEvent(new Event(COUNTRY_CHANGE_EVENT));
  }, []);

  const formatLocalPrice = (priceIDR: number, priceUSD: number) => {
    if (country.code === "ID") {
      // Use exact IDR from DB
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
      }).format(priceIDR);
    } else {
      // Calculate from USD for other currencies
      const localValue = priceUSD * country.rateToUSD;
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: country.currency,
        currencyDisplay: "symbol",
      }).format(localValue);
    }
  };

  return (
    <CurrencyContext.Provider value={{ country, setCountry, formatLocalPrice }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}
