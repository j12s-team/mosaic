import type { Config } from "tailwindcss";

/**
 * Material Design 3 theme — tokens per DESIGN.md, palettes seeded from
 * brand blue #319eff (openspec/changes/md3-redesign/design.md).
 */
const md3 = (v: string) => `rgb(var(--md-sys-color-${v}) / <alpha-value>)`;
const ext = (v: string) => `rgb(var(--md-ext-color-${v}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // --- M3 color roles ---
        primary: {
          DEFAULT: md3("primary"),
          container: md3("primary-container"),
        },
        "on-primary": {
          DEFAULT: md3("on-primary"),
          container: md3("on-primary-container"),
        },
        secondary: {
          DEFAULT: md3("secondary"),
          container: md3("secondary-container"),
        },
        "on-secondary": {
          DEFAULT: md3("on-secondary"),
          container: md3("on-secondary-container"),
        },
        tertiary: {
          DEFAULT: md3("tertiary"),
          container: md3("tertiary-container"),
        },
        "on-tertiary": {
          DEFAULT: md3("on-tertiary"),
          container: md3("on-tertiary-container"),
        },
        error: {
          DEFAULT: md3("error"),
          container: md3("error-container"),
        },
        "on-error": {
          DEFAULT: md3("on-error"),
          container: md3("on-error-container"),
        },
        background: md3("background"),
        "on-background": md3("on-background"),
        surface: {
          DEFAULT: md3("surface"),
          variant: md3("surface-variant"),
          "container-lowest": md3("surface-container-lowest"),
          "container-low": md3("surface-container-low"),
          container: md3("surface-container"),
          "container-high": md3("surface-container-high"),
          "container-highest": md3("surface-container-highest"),
        },
        "on-surface": {
          DEFAULT: md3("on-surface"),
          variant: md3("on-surface-variant"),
        },
        outline: {
          DEFAULT: md3("outline"),
          variant: md3("outline-variant"),
        },
        "inverse-surface": md3("inverse-surface"),
        "inverse-on-surface": md3("inverse-on-surface"),
        "inverse-primary": md3("inverse-primary"),

        // --- Semantic extensions (harmonized custom colors) ---
        success: {
          DEFAULT: ext("success"),
          container: ext("success-container"),
        },
        "on-success": {
          DEFAULT: ext("on-success"),
          container: ext("on-success-container"),
        },
        warning: {
          DEFAULT: ext("warning"),
          container: ext("warning-container"),
        },
        "on-warning": {
          DEFAULT: ext("on-warning"),
          container: ext("on-warning-container"),
        },

      },
      // --- M3 shape scale (DESIGN.md `shapes`) ---
      borderRadius: {
        none: "0px",
        xs: "4px",
        sm: "8px",
        md: "12px",
        DEFAULT: "12px",
        lg: "16px",
        xl: "28px",
        full: "9999px",
      },
      // --- M3 elevation (DESIGN.md `elevation`) ---
      boxShadow: {
        "elevation-0": "none",
        "elevation-1":
          "0px 1px 3px 1px rgba(0,0,0,0.15), 0px 1px 2px 0px rgba(0,0,0,0.30)",
        "elevation-2":
          "0px 2px 6px 2px rgba(0,0,0,0.15), 0px 1px 2px 0px rgba(0,0,0,0.30)",
        "elevation-3":
          "0px 4px 8px 3px rgba(0,0,0,0.15), 0px 1px 3px 0px rgba(0,0,0,0.30)",
        "elevation-4":
          "0px 6px 10px 4px rgba(0,0,0,0.15), 0px 2px 3px 0px rgba(0,0,0,0.30)",
        "elevation-5":
          "0px 8px 12px 6px rgba(0,0,0,0.15), 0px 4px 4px 0px rgba(0,0,0,0.30)",
      },
      // --- M3 type scale (DESIGN.md `typography`) ---
      fontSize: {
        "display-lg": [
          "57px",
          { lineHeight: "64px", letterSpacing: "-0.25px", fontWeight: "400" },
        ],
        "display-md": [
          "45px",
          { lineHeight: "52px", letterSpacing: "0px", fontWeight: "400" },
        ],
        "headline-lg": [
          "32px",
          { lineHeight: "40px", letterSpacing: "0px", fontWeight: "400" },
        ],
        "headline-md": [
          "28px",
          { lineHeight: "36px", letterSpacing: "0px", fontWeight: "400" },
        ],
        "title-lg": [
          "22px",
          { lineHeight: "28px", letterSpacing: "0px", fontWeight: "400" },
        ],
        "title-md": [
          "16px",
          { lineHeight: "24px", letterSpacing: "0.15px", fontWeight: "500" },
        ],
        "body-lg": [
          "16px",
          { lineHeight: "24px", letterSpacing: "0.5px", fontWeight: "400" },
        ],
        "body-md": [
          "14px",
          { lineHeight: "20px", letterSpacing: "0.25px", fontWeight: "400" },
        ],
        "label-lg": [
          "14px",
          { lineHeight: "20px", letterSpacing: "0.1px", fontWeight: "500" },
        ],
        "label-md": [
          "12px",
          { lineHeight: "16px", letterSpacing: "0.5px", fontWeight: "500" },
        ],
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Roboto", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular"],
      },
      maxWidth: {
        // DESIGN.md layout.max-width-desktop
        content: "1200px",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-slow": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.5s ease-out",
        "pulse-slow": "pulse-slow 3s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
