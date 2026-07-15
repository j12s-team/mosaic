import type { Metadata } from "next";
import localFont from "next/font/local";
import "@mosaic/ui/styles.css";
import { themeBootScript } from "@mosaic/ui/ThemeToggle";
import { Analytics } from "@/components/Analytics";

// M3 typography relies on the Roboto family (DESIGN.md). Self-hosted for
// deterministic builds (no network fetch at build time).
const roboto = localFont({
  src: [
    { path: "./fonts/roboto-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/roboto-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mosaic-ivory.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Mosaic — Your personal crypto hedge fund, run by an agent",
  description:
    "Describe a thesis. Mosaic uses SoSoValue's index, news and flow data to construct a thematic on-chain portfolio, executes it through SoDEX's orderbook, and proposes rebalances when the data shifts.",
  keywords: [
    "SoSoValue",
    "SoDEX",
    "ValueChain",
    "agentic finance",
    "AI x Web3",
    "on-chain index",
  ],
  openGraph: {
    title: "Mosaic — Agentic on-chain index manager",
    description: "Thesis in, thematic index out. Powered by SoSoValue + SoDEX.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Mosaic" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Mosaic — Agentic on-chain index manager",
    description: "Thesis in, thematic index out.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={roboto.variable}>
      <head>
        {/* Block painting until we've set the theme class to avoid FOUC. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        {/* Brand-layer typefaces (DESIGN.md Layer 1) — marketing surfaces only.
            TODO(phase-4): self-host these woff2 files per DESIGN.md's
            deterministic-builds rule and switch to next/font/local. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Michroma&family=Space+Grotesk:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body className="min-h-screen font-sans">
        <Analytics />
        {children}
      </body>
    </html>
  );
}
