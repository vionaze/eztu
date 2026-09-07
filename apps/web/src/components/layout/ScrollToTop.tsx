"use client";

import { ArrowUp } from "@phosphor-icons/react";

export default function ScrollToTop() {
  return (
    <button
      type="button"
      aria-label="Scroll to top"
      title="Scroll to top"
      onClick={() => window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      })}
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-accent/30 bg-bg-card text-accent shadow-[var(--shadow-glow)] transition-colors hover:border-accent hover:bg-accent hover:text-bg-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent md:right-6 md:bottom-6"
    >
      <ArrowUp size={22} weight="bold" aria-hidden="true" />
    </button>
  );
}
