import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  scope: "/",
  disable: false,
  cacheOnNavigation: true,
  globPublicPatterns: ["**/*.{js,css,html,woff,woff2,ttf,eot,ico,svg,png,jpg,jpeg,gif,webp}"]
});
const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  turbopack: {},
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          },
          {
            key: "X-Frame-Options",
            value: "DENY"
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin"
          }
        ]
      }
    ];
  },
  experimental: {
    optimizePackageImports: undefined
  }
  // experimental: {
  //   optimizePackageImports: [], // disable dengan benar
  //   turbopackFileSystemCacheForDev: true
  // }
  /* config options here */
};

export default withSerwist(nextConfig);
