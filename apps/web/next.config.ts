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
  // CSP kept pragmatic for Clerk + Crisp + Cryptomus checkout redirects.
  // Tighten further once third-party origins are fully inventoried.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.com https://client.crisp.chat https://*.crisp.chat",
      "style-src 'self' 'unsafe-inline' https://client.crisp.chat https://*.crisp.chat",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://client.crisp.chat",
      "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://api.cryptomus.com https://client.crisp.chat https://*.crisp.chat wss://*.crisp.chat https://*.eztopup.io",
      "frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://game.crisp.chat https://*.cryptomus.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self' https://*.clerk.accounts.dev https://*.clerk.com https://*.cryptomus.com",
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
