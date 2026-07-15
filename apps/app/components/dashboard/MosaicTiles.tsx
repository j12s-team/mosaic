"use client";

import { seriesColors, useChartColors } from "@mosaic/ui/chartColors";
import type { Basket } from "@mosaic/core/types";

/**
 * The logo, structurally: every position is a tile, area ~ weight, the
 * tessellation is the basket. Chart-palette colors (the sanctioned literal-
 * color layer), tile-in stagger on mount, rebalance-pulse when flagged.
 */
export function MosaicTiles({
  basket,
  pulseSymbols = [],
}: {
  basket: Basket;
  pulseSymbols?: string[];
}) {
  const colors = useChartColors();
  const palette = seriesColors(colors);
  const total = basket.constituents.reduce((s, c) => s + c.weight, 0) || 1;

  return (
    <div>
      <div className="flex h-28 w-full gap-1 sm:h-32" role="img" aria-label="Basket weight mosaic">
        {basket.constituents.map((c, i) => (
          <div
            key={c.symbol}
            className={`tile-in flex min-w-0 flex-col justify-end rounded-md p-1.5 ${
              pulseSymbols.includes(c.symbol) ? "rebalance-pulse" : ""
            }`}
            style={
              {
                flexGrow: Math.max(c.weight / total, 0.04),
                flexBasis: 0,
                background: palette[i % palette.length],
                "--tile-i": i,
              } as React.CSSProperties
            }
            title={`${c.symbol} ${(c.weight * 100).toFixed(1)}%`}
          >
            <span className="truncate text-[10px] font-medium leading-tight text-white/95 mix-blend-luminosity">
              {c.symbol}
            </span>
            <span className="text-[9px] tabular-nums text-white/75">
              {(c.weight * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] uppercase tracking-wider text-on-surface-variant">
        each tile is a position — the mosaic is your basket
      </p>
    </div>
  );
}
