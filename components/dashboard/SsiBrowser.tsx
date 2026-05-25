"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Layers, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import type { Basket, ExecutionPlan } from "@/lib/types";

interface SsiIndex {
  symbol: string;
  name: string;
  description?: string;
  changePct?: number;
  constituents: Array<{ symbol: string; weight: number }>;
}

interface Props {
  amountUsd: number;
  risk: "conservative" | "balanced" | "aggressive";
  onLoaded: (data: { basket: Basket; plan: ExecutionPlan; index: SsiIndex }) => void;
}

/**
 * Lets the user one-click pull a SoSoValue SSI index and convert it into a
 * Mosaic basket. This is the "cross-product integration" demo — judges see
 * the SoSoValue index data flow directly into the SoDEX execution plan.
 */
export function SsiBrowser({ amountUsd, risk, onLoaded }: Props) {
  const [indexes, setIndexes] = useState<SsiIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [buildingSymbol, setBuildingSymbol] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ssi")
      .then((r) => r.json())
      .then((d) => setIndexes(d.indexes ?? []))
      .catch(() => setIndexes([]))
      .finally(() => setLoading(false));
  }, []);

  async function buildFromSsi(symbol: string) {
    setBuildingSymbol(symbol);
    try {
      const res = await fetch("/api/ssi/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, amountUsd, risk }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Failed to load SSI");
        return;
      }
      const data = await res.json();
      onLoaded(data);
    } finally {
      setBuildingSymbol(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-brand-600 dark:text-brand-300" />
          One-click SoSoValue Indexes
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Mirror any SSI index as a Mosaic basket — composition pulled live from the SoSoValue
          Index API, then routed to the SoDEX orderbook with explicit human confirmation.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-6 text-center text-xs text-muted-foreground">Loading SSI catalog…</div>
        ) : indexes.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">No SSI indexes available right now.</div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {indexes.map((idx) => {
              const up = (idx.changePct ?? 0) >= 0;
              return (
                <div
                  key={idx.symbol}
                  className="rounded-lg border border-border/40 bg-secondary/30 dark:bg-background/40 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="brand" className="text-[10px]">
                          {idx.symbol}
                        </Badge>
                        {idx.changePct !== undefined && (
                          <span
                            className={`flex items-center gap-0.5 font-mono text-[10px] ${
                              up ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
                            }`}
                          >
                            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {(idx.changePct * 100).toFixed(2)}%
                          </span>
                        )}
                      </div>
                      <div className="mt-1 truncate text-sm font-medium">{idx.name}</div>
                      {idx.description && (
                        <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                          {idx.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {idx.constituents.slice(0, 5).map((c) => (
                          <span
                            key={c.symbol}
                            className="rounded-md border border-border/40 bg-card/80 dark:bg-card/40 px-1.5 py-0.5 font-mono text-[10px]"
                          >
                            {c.symbol} {(c.weight * 100).toFixed(0)}%
                          </span>
                        ))}
                        {idx.constituents.length > 5 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{idx.constituents.length - 5}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => buildFromSsi(idx.symbol)}
                      disabled={buildingSymbol === idx.symbol}
                    >
                      <Sparkles className="h-3 w-3" />
                      {buildingSymbol === idx.symbol ? "Building…" : "Use as basket"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
