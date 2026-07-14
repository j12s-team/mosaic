/** @type {import('next').NextConfig} */
const appUrl = process.env.NEXT_PUBLIC_APP_URL;

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@mosaic/core", "@mosaic/ui"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async redirects() {
    if (!appUrl) return [];
    return [
      { source: "/app", destination: appUrl, permanent: false },
      { source: "/b", destination: `${appUrl}/b`, permanent: false },
      { source: "/b/:slug*", destination: `${appUrl}/b/:slug*`, permanent: false },
    ];
  },
};

export default nextConfig;
