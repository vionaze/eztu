"use client";

import { useClerk } from "@clerk/nextjs";
import { useState } from "react";

export default function ResellerLogoutButton() {
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
      className="mt-3 inline-flex h-10 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary transition hover:border-red-400/40 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isSigningOut ? "Logging out…" : "Log out"}
    </button>
  );
}
