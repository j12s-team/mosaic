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
