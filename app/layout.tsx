import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { themeBootScript } from "@/components/ThemeToggle";

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

export const metadata: Metadata = {
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
    "buildathon",
  ],
  openGraph: {
    title: "Mosaic — Agentic on-chain index manager",
    description:
      "Thesis in, thematic index out. Powered by SoSoValue + SoDEX.",
    type: "website",
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
      </head>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
