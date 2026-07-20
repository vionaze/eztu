"use client";

import { useEffect } from "react";
import { useAuth, useUser } from "@clerk/nextjs";

const CRISP_WEBSITE_ID = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID?.trim() || "";

declare global {
  interface Window {
    $crisp: unknown[];
    CRISP_WEBSITE_ID: string;
  }
}

function crispPush(command: unknown[]) {
  if (typeof window === "undefined") return;
  if (!window.$crisp) {
    window.$crisp = [];
  }
  window.$crisp.push(command);
}

function ensureCrispScript() {
  if (typeof document === "undefined") return;
  if (document.getElementById("crisp-chat-script")) return;

  if (!window.$crisp) {
    window.$crisp = [];
  }
  window.CRISP_WEBSITE_ID = CRISP_WEBSITE_ID;

  const script = document.createElement("script");
  script.id = "crisp-chat-script";
  script.src = "https://client.crisp.chat/l.js";
  script.async = true;
  document.head.appendChild(script);
}

/**
 * Crisp support chat — only for signed-in users.
 * Guests do not see the widget; after login it loads and shows.
 */
export default function CrispChat() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    if (!CRISP_WEBSITE_ID || !isLoaded) return;

    if (!isSignedIn) {
      crispPush(["do", "chat:hide"]);
      crispPush(["do", "chat:close"]);
      return;
    }

    ensureCrispScript();
    crispPush(["do", "chat:show"]);

    const email = user?.primaryEmailAddress?.emailAddress;
    const name =
      user?.fullName ||
      [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
      undefined;

    if (email) {
      crispPush(["set", "user:email", [email]]);
    }
    if (name) {
      crispPush(["set", "user:nickname", [name]]);
    }
    if (user?.id) {
      crispPush(["set", "session:data", [[["clerk_user_id", user.id]]]]);
    }
  }, [isLoaded, isSignedIn, user]);

  return null;
}
