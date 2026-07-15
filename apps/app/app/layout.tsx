import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "@mosaic/ui/styles.css";
import { themeBootScript } from "@mosaic/ui/ThemeToggle";
import { OfflineBanner } from "@/components/OfflineBanner";

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
  title: "Mosaic — agentic on-chain index manager",
  description:
    "Thesis in, thematic on-chain index out. Build, backtest, execute and maintain a risk-aware basket with the Mosaic agent — you stay in the confirm loop.",
  applicationName: "Mosaic",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mosaic",
  },
  openGraph: {
    title: "Mosaic — agentic on-chain index manager",
    description: "Thesis in, thematic on-chain index out.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Mosaic" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FDFCFF" },
    { media: "(prefers-color-scheme: dark)", color: "#1A1C1E" },
  ],
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
      <body className="min-h-screen font-sans">
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}
