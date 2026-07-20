"use client";

import { useEffect } from "react";

const CRISP_WEBSITE_ID = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID?.trim() || "";

declare global {
  interface Window {
    $crisp: unknown[];
    CRISP_WEBSITE_ID: string;
  }
}

/**
 * Crisp support chat for all storefront visitors (no login required).
 * Set NEXT_PUBLIC_CRISP_WEBSITE_ID from Crisp → Settings → Website settings.
 * Leave empty to disable the widget.
 */
export default function CrispChat() {
  useEffect(() => {
    if (!CRISP_WEBSITE_ID || typeof window === "undefined") return;
    if (document.getElementById("crisp-chat-script")) return;

    window.$crisp = window.$crisp || [];
    window.CRISP_WEBSITE_ID = CRISP_WEBSITE_ID;

    const script = document.createElement("script");
    script.id = "crisp-chat-script";
    script.src = "https://client.crisp.chat/l.js";
    script.async = true;
    document.head.appendChild(script);
  }, []);

  return null;
}
