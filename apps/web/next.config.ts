import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = dirname(fileURLToPath(import.meta.url));
// Monorepo root so Turbopack can resolve workspace packages + next.
const workspaceRoot = resolve(appRoot, "../..");

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // Clerk Frontend API is on custom domain clerk.eztopup.io (not only *.clerk.com).
  // CAPTCHA uses Cloudflare Turnstile + Clerk protect hosts — must be allowed or SignIn
  // shows "The CAPTCHA failed to load" (desktop + mobile).
  // Docs: https://clerk.com/docs/guides/secure/best-practices/csp-headers
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      [
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "https://*.clerk.accounts.dev",
        "https://*.clerk.com",
        "https://clerk.eztopup.io",
        "https://*.eztopup.io",
        "https://challenges.cloudflare.com",
        "https://*.protect.clerk.com",
        "https://*.hcaptcha.com",
        "https://hcaptcha.com",
        "https://www.google.com",
        "https://www.gstatic.com",
        "https://client.crisp.chat",
        "https://*.crisp.chat",
      ].join(" "),
      [
        "style-src 'self' 'unsafe-inline'",
        "https://*.clerk.accounts.dev",
        "https://*.clerk.com",
        "https://clerk.eztopup.io",
        "https://*.eztopup.io",
        "https://challenges.cloudflare.com",
        "https://*.hcaptcha.com",
        "https://hcaptcha.com",
        "https://client.crisp.chat",
        "https://*.crisp.chat",
      ].join(" "),
      "img-src 'self' data: blob: https:",
      [
        "font-src 'self' data:",
        "https://*.clerk.accounts.dev",
        "https://*.clerk.com",
        "https://clerk.eztopup.io",
        "https://client.crisp.chat",
      ].join(" "),
      [
        "connect-src 'self'",
        "https://*.clerk.accounts.dev",
        "https://*.clerk.com",
        "https://clerk.eztopup.io",
        "https://*.eztopup.io",
        "https://challenges.cloudflare.com",
        "https://*.protect.clerk.com",
        "https://*.hcaptcha.com",
        "https://hcaptcha.com",
        "https://api.cryptomus.com",
        "https://client.crisp.chat",
        "https://*.crisp.chat",
        "wss://*.crisp.chat",
        "wss://*.clerk.accounts.dev",
        "wss://clerk.eztopup.io",
      ].join(" "),
      [
        "frame-src 'self'",
        "https://*.clerk.accounts.dev",
        "https://*.clerk.com",
        "https://clerk.eztopup.io",
        "https://*.eztopup.io",
        "https://challenges.cloudflare.com",
        "https://*.protect.clerk.com",
        "https://*.hcaptcha.com",
        "https://hcaptcha.com",
        "https://newassets.hcaptcha.com",
        "https://www.google.com",
        "https://recaptcha.google.com",
        "https://game.crisp.chat",
        "https://*.cryptomus.com",
      ].join(" "),
      "worker-src 'self' blob:",
      "child-src 'self' blob: https://challenges.cloudflare.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      [
        "form-action 'self'",
        "https://*.clerk.accounts.dev",
        "https://*.clerk.com",
        "https://clerk.eztopup.io",
        "https://*.eztopup.io",
        "https://challenges.cloudflare.com",
        "https://*.cryptomus.com",
      ].join(" "),
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@kupon/db", "@kupon/payments", "@kupon/ui"],
  turbopack: {
    root: workspaceRoot,
  },
  poweredByHeader: false,
  images: {
    // Blog hero/thumbnail are pasted as manual URLs (any CDN/host).
    // Local /public paths work without remotePatterns.
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "**.cloudinary.com" },
      { protocol: "https", hostname: "i.imgur.com" },
      { protocol: "https", hostname: "cdn.discordapp.com" },
      { protocol: "https", hostname: "eztopup.io" },
      { protocol: "https", hostname: "**.eztopup.io" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
