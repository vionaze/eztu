"use client";

import { useState } from "react";
import { Check, CopySimple } from "@phosphor-icons/react";

export default function CopyVoucherButton({
  value,
  ariaLabel = "Copy voucher code",
}: {
  value: string;
  ariaLabel?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={ariaLabel}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-muted transition-all hover:border-accent/40 hover:text-text-primary"
    >
      {copied ? (
        <Check size={15} weight="bold" className="text-accent" />
      ) : (
        <CopySimple size={15} weight="bold" />
      )}
    </button>
  );
}
