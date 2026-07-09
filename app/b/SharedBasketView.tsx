"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/landing/Navbar";
import { BasketProposal } from "@/components/dashboard/BasketProposal";
import { BacktestPanel } from "@/components/dashboard/BacktestPanel";
import { MonteCarloPanel } from "@/components/dashboard/MonteCarloPanel";
import { StressTestPanel } from "@/components/dashboard/StressTestPanel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { decodeShare, type SharePayload } from "@/lib/share";
import type { BacktestResult } from "@/lib/backtest";
import type { MonteCarloResult } from "@/lib/montecarlo";
import type { ScenarioResult } from "@/lib/scenarios";
import { ArrowRight, Share2 } from "lucide-react";

export default function SharedBasketView() {
  const params = useSearchParams();
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backtest, setBacktest] = useState<BacktestResult | null>(null);
  const [mc, setMc] = useState<MonteCarloResult | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioResult[] | null>(null);

  useEffect(() => {
    const d = params.get("d");
    if (!d) {
      setError("No basket data in the URL. Open a /b?d=… link to view a shared basket.");
      return;
    }
    const decoded = decodeShare(d);
    if (!decoded) {
      setError("This share link is invalid or corrupted.");
      return;
    }
    setPayload(decoded);
    // Kick off the analytical pipeline against this basket.
    fetch("/api/backtest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ basket: decoded.basket, horizonDays: 90 }),
    })
      .then((r) => r.json())
      .then((data) => {
        setBacktest(data.backtest);
        setMc(data.monteCarlo);
        setScenarios(data.scenarios);
      })
      .catch(() => {});
  }, [params]);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 pt-10 pb-24">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
              <Share2 className="h-3 w-3" />
              Shared basket
            </div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              A basket someone built with Mosaic
            </h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              Read-only view. Build your own with one click.
            </p>
          </div>
          <Link href="/app">
            <Button>
              Build my own <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        {error && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-on-surface-variant">
              {error}
            </CardContent>
          </Card>
        )}

        {payload && (
          <div className="space-y-6">
            <BasketProposal basket={payload.basket} />
            {backtest && <BacktestPanel result={backtest} />}
            {mc && <MonteCarloPanel result={mc} />}
            {scenarios && <StressTestPanel results={scenarios} />}
          </div>
        )}
      </main>
    </>
  );
}
