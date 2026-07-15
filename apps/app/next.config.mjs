import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Never ship a stale-cache bug to a trading product from dev builds.
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@mosaic/core", "@mosaic/ui"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default withSerwist(nextConfig);
