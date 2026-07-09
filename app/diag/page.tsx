"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Radio,
  WifiOff,
} from "lucide-react";

interface Diag {
  env: {
    network: string;
    sosoKey: boolean;
    sodexKey: boolean;
    sodexSecret: boolean;
    useMocks: boolean;
    anthropicKey: boolean;
  };
  sodex: { tickers: unknown; walletBalances: unknown };
  sosovalue: { news: unknown; ssiIndexes: unknown; btcMetrics: unknown; taoMetrics: unknown };
  timestamp: string;
}

function hasError(v: unknown): v is { error: string } {
  return typeof v === "object" && v !== null && "error" in v;
}
function count(v: unknown): number | null {
  if (typeof v === "object" && v !== null && "count" in v) {
    const c = (v as { count: unknown }).count;
    return typeof c === "number" ? c : null;
  }
  return null;
}

function StatusCard({
  label,
  value,
  okText,
}: {
  label: string;
  value: unknown;
  okText: (v: unknown) => string;
}) {
  const err = hasError(value);
  return (
    <div className="rounded-md border border-outline-variant bg-surface-container-low dark:bg-surface-container-low p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium">{label}</span>
        {err ? (
          <Badge variant="danger" className="text-[10px]">
            <AlertTriangle className="h-3 w-3" /> error
          </Badge>
        ) : (
          <Badge variant="success" className="text-[10px]">
            <CheckCircle2 className="h-3 w-3" /> reachable
          </Badge>
        )}
      </div>
      <p className="mt-2 break-words text-[11px] text-on-surface-variant">
        {err ? (value as { error: string }).error : okText(value)}
      </p>
    </div>
  );
}

function EnvChip({ label, on }: { label: string; on: boolean }) {
  return (
    <Badge variant={on ? "success" : "outline"} className="text-[10px]">
      {label} {on ? "✓" : "—"}
    </Badge>
  );
}

export default function DiagPage() {
  const [data, setData] = useState<Diag | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const r = await fetch("/api/diag", { cache: "no-store" });
      setData(await r.json());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Badge variant="brand" className="mb-4">
              <Radio className="h-3 w-3" /> Live diagnostics
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Integration status
            </h1>
            <p className="mt-3 max-w-2xl text-base text-on-surface-variant">
              This page calls every SoSoValue and SoDEX integration right now and reports what came
              back — so you can verify the wiring without digging through server logs.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Re-run
          </Button>
        </div>

        {loading && !data ? (
          <div className="mt-10 flex items-center gap-2 text-sm text-on-surface-variant">
            <Loader2 className="h-4 w-4 animate-spin" /> Probing live integrations…
          </div>
        ) : failed ? (
          <div className="mt-10 flex items-center gap-2 rounded-md border border-error/30 bg-error/5 p-4 text-sm text-error">
            <WifiOff className="h-4 w-4" /> Could not reach /api/diag. Try Re-run.
          </div>
        ) : data ? (
          <div className="mt-8 space-y-8">
            <section>
              <h2 className="text-[10px] uppercase tracking-wider text-on-surface-variant">
                Environment
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="brand" className="text-[10px]">
                  network: {data.env.network}
                </Badge>
                <EnvChip label="SoSoValue key" on={data.env.sosoKey} />
                <EnvChip label="SoDEX key" on={data.env.sodexKey} />
                <EnvChip label="SoDEX secret" on={data.env.sodexSecret} />
                <EnvChip label="Anthropic key" on={data.env.anthropicKey} />
                <Badge variant={data.env.useMocks ? "warning" : "outline"} className="text-[10px]">
                  forced mocks {data.env.useMocks ? "on" : "off"}
                </Badge>
              </div>
            </section>

            <section>
              <h2 className="text-[10px] uppercase tracking-wider text-on-surface-variant">SoDEX</h2>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <StatusCard
                  label="GET /markets/tickers"
                  value={data.sodex.tickers}
                  okText={(v) => `${count(v) ?? "?"} markets returned`}
                />
                <StatusCard
                  label="GET /accounts/{address}/balances"
                  value={data.sodex.walletBalances}
                  okText={(v) =>
                    typeof v === "object" && v !== null && "skipped" in v
                      ? "skipped — add ?address= to test"
                      : `${count(v) ?? "?"} balance rows`
                  }
                />
              </div>
            </section>

            <section>
              <h2 className="text-[10px] uppercase tracking-wider text-on-surface-variant">
                SoSoValue
              </h2>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <StatusCard
                  label="GET /api/v1/news/featured/currency"
                  value={data.sosovalue.news}
                  okText={(v) => `${count(v) ?? "?"} news items`}
                />
                <StatusCard
                  label="GET /api/v1/index/list"
                  value={data.sosovalue.ssiIndexes}
                  okText={(v) => `${count(v) ?? "?"} SSI indices`}
                />
                <StatusCard
                  label="GET /api/v1/token/BTC/metrics"
                  value={data.sosovalue.btcMetrics}
                  okText={() => "metrics returned"}
                />
                <StatusCard
                  label="GET /api/v1/token/TAO/metrics"
                  value={data.sosovalue.taoMetrics}
                  okText={() => "metrics returned"}
                />
              </div>
            </section>

            <p className="text-[11px] text-on-surface-variant">
              Probed at {new Date(data.timestamp).toLocaleString()}. A “reachable” badge means the
              endpoint answered; “error” means Mosaic fell back to curated data for that surface.
              See the{" "}
              <Link href="/judges" className="text-primary underline-offset-4 hover:underline">
                judge&apos;s guide
              </Link>{" "}
              for what&apos;s live vs simulated.
            </p>

            <details className="rounded-md border border-outline-variant bg-surface-container-low dark:bg-surface-container-low p-4">
              <summary className="cursor-pointer text-xs font-medium text-on-surface-variant">
                Raw /api/diag response
              </summary>
              <pre className="mt-3 overflow-x-auto text-[10px] leading-relaxed text-on-surface-variant">
                {JSON.stringify(data, null, 2)}
              </pre>
            </details>
          </div>
        ) : null}
      </main>
      <Footer />
    </>
  );
}
