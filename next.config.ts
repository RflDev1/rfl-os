import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.RFL_NEXT_DIST_DIR ?? ".next",
  experimental: {
    serverActions: {
      // The application validates card art at 5 MB. This extra margin covers
      // multipart form metadata while preserving an upstream request cap.
      bodySizeLimit: "6mb",
    },
  },
  output: "standalone",
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.discordapp.com" },
      { protocol: "https", hostname: "*.digitaloceanspaces.com" },
    ],
  },
  async headers() {
    const scriptPolicy = process.env.NODE_ENV === "production" ? "'self' 'unsafe-inline'" : "'self' 'unsafe-inline' 'unsafe-eval'";
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: https://cdn.discordapp.com https://*.digitaloceanspaces.com; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src ${scriptPolicy}; connect-src 'self'; upgrade-insecure-requests`,
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
