"use client";

import { useState, useRef, useEffect } from "react";
import { COUNTRIES } from "@/lib/currencies";
import { useCurrency } from "@/context/CurrencyContext";
import { CaretDown, Check } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function CountrySelector() {
  const { country, setCountry } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-card hover:bg-bg-elevated border border-border hover:border-border-hover transition-all text-sm font-medium"
      >
        <span className="text-lg leading-none">{country.flag}</span>
        <span className="hidden sm:inline-block text-text-primary">{country.name}</span>
        <CaretDown
          size={14}
          className={cn("text-text-muted transition-transform", isOpen && "rotate-180")}
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute right-0 top-full mt-2 w-56 p-1.5 rounded-2xl bg-bg-elevated border border-border shadow-[var(--shadow-glow)] z-50"
          >
            <div className="max-h-[300px] overflow-y-auto scrollbar-hide space-y-1">
              {COUNTRIES.map((c) => (
                <button
                  key={c.code}
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
                    <span>{c.name}</span>
                  </div>
                  {country.code === c.code && <Check size={16} weight="bold" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
