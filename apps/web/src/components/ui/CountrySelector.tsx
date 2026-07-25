"use client";

import { useState, useRef, useEffect } from "react";
import { COUNTRIES } from "@/lib/currencies";
import { useCurrency } from "@/context/CurrencyContext";
import { CaretDown, Check } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type CountrySelectorProps = {
  /** Compact flag-only control for mobile header */
  compact?: boolean;
  className?: string;
};

export default function CountrySelector({
  compact = false,
  className,
}: CountrySelectorProps) {
  const { country, setCountry } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Country / currency: ${country.name}`}
        className={cn(
          "flex items-center rounded-xl bg-bg-card hover:bg-bg-elevated border border-border hover:border-border-hover transition-all font-medium",
          compact
            ? "gap-1 h-9 min-w-9 px-2 justify-center text-sm"
            : "gap-2 px-3 py-2 text-sm"
        )}
      >
        <span className="text-lg leading-none">{country.flag}</span>
        {!compact ? (
          <span className="hidden sm:inline-block text-text-primary">
            {country.name}
          </span>
        ) : null}
        <CaretDown
          size={compact ? 12 : 14}
          className={cn(
            "text-text-muted transition-transform shrink-0",
            compact && "opacity-80",
            isOpen && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 360, damping: 28 }}
            className={cn(
              // High z so it floats above header / mobile chrome
              "absolute right-0 top-full mt-2 w-56 p-1.5 rounded-2xl",
              "bg-bg-elevated border border-border shadow-[var(--shadow-glow)]",
              "z-[80] max-h-[min(70vh,320px)] overflow-y-auto overscroll-contain"
            )}
          >
            <div className="space-y-1">
              {COUNTRIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  role="option"
                  aria-selected={country.code === c.code}
                  onClick={() => {
                    setCountry(c);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all text-left",
                    country.code === c.code
                      ? "bg-accent/10 text-accent font-medium"
                      : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg leading-none">{c.flag}</span>
                    <span>
                      {c.name}
                      <span className="text-text-muted ml-1.5 text-xs">
                        {c.currency}
                      </span>
                    </span>
                  </div>
                  {country.code === c.code ? (
                    <Check size={16} weight="bold" />
                  ) : null}
                </button>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
