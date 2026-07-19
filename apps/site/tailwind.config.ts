import type { Config } from "tailwindcss";
import preset from "@mosaic/ui/tailwind-preset";

const config: Config = {
  presets: [preset as unknown as Config],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // Brand layer (DESIGN.md Layer 1) — marketing surfaces only.
      fontFamily: {
        brand: ["Michroma", "sans-serif"],
        "brand-body": ["'Space Grotesk'", "sans-serif"],
        "brand-mono": ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        void: "#080611",
        "brand-panel": "#120D24",
        "brand-text": "#EFEAFF",
        "brand-dim": "#A99FD0",
      },
    },
  },
};
export default config;
