import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = dirname(fileURLToPath(import.meta.url));
// Monorepo root so Turbopack can resolve workspace packages + next.
const workspaceRoot = resolve(appRoot, "../..");

const nextConfig: NextConfig = {
  transpilePackages: ["@kupon/db", "@kupon/payments", "@kupon/ui"],
  turbopack: {
    root: workspaceRoot,
  },
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
};

export default nextConfig;
