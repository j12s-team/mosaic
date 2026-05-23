import type { Metadata } from "next";
import "./globals.css";
import { themeBootScript } from "@/components/ThemeToggle";

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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Block painting until we've set the theme class to avoid FOUC. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
