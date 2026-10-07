"use client";

import { useClerk } from "@clerk/nextjs";
import { SignOut } from "@phosphor-icons/react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const baseClass =
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

export default function ResellerLogoutButton({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { signOut } = useClerk();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    await signOut({ redirectUrl: "/" });
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isSigningOut}
      aria-label="Log out"
      title="Log out"
      className={cn(
        baseClass,
        className ??
          "mt-3 h-10 border border-border px-4 text-text-secondary hover:border-red-400/40 hover:text-red-200",
      )}
    >
      {compact ? <SignOut size={15} aria-hidden="true" /> : null}
      <span className={cn(compact && "hidden sm:inline")}>
        {isSigningOut ? "Logging out…" : "Log out"}
      </span>
    </button>
  );
}
