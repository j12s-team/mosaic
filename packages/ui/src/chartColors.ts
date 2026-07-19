"use client";

import { useEffect, useState } from "react";

/**
 * Chart palette — part of the M3 theme layer. This is the single place
 * (outside globals.css) where literal color values are permitted; every
 * chart reads its colors from here so visualizations follow the active
 * scheme. Values mirror the M3 role tokens in app/globals.css.
 */
interface ChartColorsShape {
  primary: string;
  primaryContainer: string;
  secondary: string;
  tertiary: string;
  error: string;
  success: string;
  warning: string;
  onSurface: string;
  onSurfaceVariant: string;
  outlineVariant: string;
  surfaceContainerHigh: string;
  surfaceContainerLow: string;
  surfaceContainerLowest: string;
}

export const chartPalette: { light: ChartColorsShape; dark: ChartColorsShape } = {
  light: {
    primary: "#0061A6",
    primaryContainer: "#D2E4FF",
    secondary: "#535F70",
    tertiary: "#6B5778",
    error: "#BA1A1A",
    success: "#146C3A",
    warning: "#795A00",
    onSurface: "#1A1C1E",
    onSurfaceVariant: "#43474E",
    outlineVariant: "#C3C6CF",
    surfaceContainerHigh: "#E8E8EB",
    surfaceContainerLow: "#F4F3F7",
    surfaceContainerLowest: "#FFFFFF",
  },
  dark: {
    primary: "#A0CAFF",
    primaryContainer: "#00497E",
    secondary: "#BBC7DB",
    tertiary: "#D7BEE4",
    error: "#FFB4AB",
    success: "#95D6A8",
    warning: "#F5BE48",
    onSurface: "#E3E2E6",
    onSurfaceVariant: "#C3C6CF",
    outlineVariant: "#43474E",
    surfaceContainerHigh: "#292A2D",
    surfaceContainerLow: "#1A1C1E",
    surfaceContainerLowest: "#0D0E11",
  },
};

export type ChartColors = ChartColorsShape;

/** Ordered categorical series palette built from M3 roles. */
export function seriesColors(c: ChartColors): string[] {
  return [c.primary, c.tertiary, c.secondary, c.success, c.warning, c.error];
}

/** Recharts tooltip contentStyle on M3 surface-container-high. */
export function tooltipStyle(c: ChartColors): React.CSSProperties {
  return {
    background: c.surfaceContainerHigh,
    border: `1px solid ${c.outlineVariant}`,
    borderRadius: 12,
    color: c.onSurface,
    fontSize: 12,
  };
}

/** Returns the active scheme's chart colors, following the html.dark class. */
export function useChartColors(): ChartColors {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.classList.contains("dark"));
    update();
    const mo = new MutationObserver(update);
    mo.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return dark ? chartPalette.dark : chartPalette.light;
}

// ---------------------------------------------------------------------------
// Canonical asset colors — industry-recognizable brand colors per symbol.
// This module is the sanctioned literal-color layer (DESIGN.md), so the map
// lives here. Unknown symbols fall back deterministically to the theme
// palette (hashed, not positional, so a symbol keeps its color everywhere).
// ---------------------------------------------------------------------------

const ASSET_COLORS: Record<string, string> = {
  BTC: "#F7931A",
  ETH: "#627EEA",
  SOL: "#9945FF",
  SOSO: "#319EFF", // brand seed — SoSoValue's own token
  USDC: "#2775CA",
  USDT: "#26A17B",
  BNB: "#F3BA2F",
  XRP: "#0085C0",
  ADA: "#2A6AC9",
  DOGE: "#C2A633",
  DOT: "#E6007A",
  AVAX: "#E84142",
  LINK: "#2A5ADA",
  UNI: "#FF007A",
  AAVE: "#B6509E",
  MATIC: "#8247E5",
  POL: "#8247E5",
  ARB: "#28A0F0",
  OP: "#FF0420",
  PENDLE: "#22B5A8",
  RNDR: "#E01E24",
  MKR: "#1AAB9B",
  ONDO: "#8FA6FF",
};

/** Normalize wrapped/staked prefixes: WBTC→BTC, WETH/STETH→ETH, WSOSO→SOSO… */
function baseSymbol(symbol: string): string {
  const s = symbol.toUpperCase().replace(/[-/].*$/, "");
  if (ASSET_COLORS[s]) return s;
  for (const prefix of ["W", "ST", "R", "CB"]) {
    if (s.startsWith(prefix) && ASSET_COLORS[s.slice(prefix.length)]) {
      return s.slice(prefix.length);
    }
  }
  return s;
}

/** Canonical color for a symbol; deterministic palette fallback otherwise. */
export function assetColor(symbol: string, fallbackPalette: string[]): string {
  const base = baseSymbol(symbol);
  if (ASSET_COLORS[base]) return ASSET_COLORS[base];
  let h = 0;
  for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) >>> 0;
  return fallbackPalette[h % fallbackPalette.length];
}

/** Readable label color for a fill: YIQ luminance → near-black or white. */
export function onAssetColor(hex: string): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? "#0B0912" : "#FFFFFF";
}
