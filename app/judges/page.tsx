import Link from "next/link";
import type { Metadata } from "next";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Clock,
  FlaskConical,
  Gauge,
  MousePointerClick,
  Radio,
  ShieldCheck,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Judge's guide · Mosaic",
  description:
    "A 60-second test script, what to look for, and exactly which SoSoValue and SoDEX integrations are live vs simulated.",
};

function Section({
  id,
  icon: Icon,
  title,
  children,
}: {
  id?: string;
  icon: typeof Clock;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <Icon className="h-4 w-4 text-brand-600 dark:text-brand-300" />
        {title}
      </h2>
      <div className="mt-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function Row({
  surface,
  status,
  detail,
}: {
  surface: string;
  status: "live" | "sim" | "computed";
  detail: string;
}) {
  const badge =
    status === "live" ? (
      <Badge variant="success" className="text-[10px] whitespace-nowrap">
        <CircleDot className="h-3 w-3" /> Live
      </Badge>
    ) : status === "computed" ? (
      <Badge variant="brand" className="text-[10px] whitespace-nowrap">
        <Gauge className="h-3 w-3" /> Computed
      </Badge>
    ) : (
      <Badge variant="warning" className="text-[10px] whitespace-nowrap">
        <FlaskConical className="h-3 w-3" /> Simulated
      </Badge>
    );
  return (
    <tr className="border-t border-border/40 align-top">
      <td className="py-3 pr-3 font-medium text-foreground">{surface}</td>
      <td className="py-3 pr-3">{badge}</td>
      <td className="py-3 text-muted-foreground">{detail}</td>
    </tr>
  );
}

function Endpoint({
  method,
  path,
  note,
  sample,
}: {
  method: string;
  path: string;
  note: string;
  sample: string;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-secondary/30 dark:bg-background/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-brand-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-brand-700 dark:text-brand-300">
          {method}
        </span>
        <code className="break-all font-mono text-xs text-foreground">{path}</code>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">{note}</p>
      <pre className="mt-2 overflow-x-auto rounded-md border border-border/40 bg-background/60 p-2 text-[10px] leading-relaxed text-muted-foreground">
        {sample}
      </pre>
    </div>
  );
}

export default function JudgesPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6">
        <Badge variant="brand" className="mb-4">
          <ShieldCheck className="h-3 w-3" /> For judges
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Judge&apos;s guide</h1>
        <p className="mt-3 max-w-2xl text-base text-muted-foreground">
          Everything you need to evaluate Mosaic in a minute — a click-by-click test script, what
          each number means, and an honest breakdown of which integrations are live, which are
          simulated, and why. No wallet, seed, or signup required.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/app">
            <Button>
              Open the agent <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/diag">
            <Button variant="secondary">
              <Radio className="h-4 w-4" /> Live integration status
            </Button>
          </Link>
        </div>

        <div className="mt-12 space-y-12">
          <Section id="test" icon={Clock} title="The 60-second test">
            <ol className="space-y-3">
              {[
                ["Open the agent", "From this page click “Open the agent” (or “Launch App”). It loads instantly against live data + safe fallbacks — nothing to configure."],
                ["Click a sample thesis", "In “Tell Mosaic your thesis”, click any card under “Try a sample thesis” — e.g. AI Infrastructure. It fills the prompt, amount and risk and submits in one click."],
                ["Watch the agent reason", "The agent log streams Parse → Score → Weight → Route. A risk-aware basket appears with per-token weights and rationale, then auto-scrolls into view."],
                ["Read the analysis", "Backtest (Sharpe / max drawdown), Monte Carlo (VaR / CVaR over 1,000 paths) and three historical stress tests render automatically. Hover any (?) for a plain-English explanation."],
                ["Execute on SoDEX", "Open the execution plan, hit Review & confirm → Confirm & execute. Mosaic walks the SoDEX orderbook, simulates IOC fills, and records the basket."],
                ["See it persist", "The executed basket appears under My baskets with its fills; the realised-vs-thesis curve begins filling in. Reload — it's still there."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-brand-500/15 font-mono text-xs font-semibold text-brand-700 dark:text-brand-300">
                    {i + 1}
                  </span>
                  <span>
                    <span className="font-medium text-foreground">{t}.</span> {d}
                  </span>
                </li>
              ))}
            </ol>
          </Section>

          <Section id="look" icon={MousePointerClick} title="What to look for">
            <ul className="space-y-2">
              <li>
                <span className="font-medium text-foreground">Distinct baskets per thesis.</span> A
                memecoin prompt and a DeFi-bluechip prompt produce genuinely different constituents,
                weights and risk scores — not one canned list.
              </li>
              <li>
                <span className="font-medium text-foreground">Risk before the click.</span> Every
                irreversible action is preceded by backtest + Monte Carlo + stress tests and an
                explicit confirm gate. No market orders; IOC limits with a per-leg slippage cap.
              </li>
              <li>
                <span className="font-medium text-foreground">Real data on the surface.</span> The
                landing page and Market Pulse pull live SoSoValue news, ETF flows and SSI moves; the
                portfolio reads live SoDEX testnet balances.
              </li>
              <li>
                <span className="font-medium text-foreground">Honest labelling.</span> Anything
                simulated says so on the screen — see the breakdown below.
              </li>
            </ul>
          </Section>

          <Section id="live" icon={CheckCircle2} title="Live vs simulated — and why">
            <p>
              Mosaic is wired to real endpoints and degrades gracefully so a demo never falls over.
              Here is exactly what is real:
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-border/40 bg-card/60 dark:bg-card/30 p-1">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2">Surface</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  <Row
                    surface="SoSoValue news / ETF flows / SSI / token metrics"
                    status="live"
                    detail="Called server-side from openapi.sosovalue.com when SOSOVALUE_API_KEY is set. Falls back to curated, deterministic mock data if a key is absent or an endpoint shape changes, so the demo always renders."
                  />
                  <Row
                    surface="SoDEX public reads — markets, orderbook, tickers, balances"
                    status="live"
                    detail="Unsigned public endpoints on the SoDEX testnet gateway. Orderbook depth drives the real slippage estimate; tickers price the portfolio; balances read your testnet account."
                  />
                  <Row
                    surface="SoDEX order placement"
                    status="sim"
                    detail="The confirm → execute path short-circuits to a deterministic simulated fill. EIP-712-signed on-chain writes are deliberately scoped to Wave 3 — we don't move funds in a demo."
                  />
                  <Row
                    surface="Backtest · Monte Carlo · stress tests"
                    status="computed"
                    detail="Pure functions over a deterministic 180-day return seed (reproducible across runs). Production drop-in is SoSoValue's token history endpoint; the math kernel is unchanged."
                  />
                  <Row
                    surface="Realised-vs-thesis tracking"
                    status="sim"
                    detail="A client-side snapshotter records basket value over time. In the demo it uses a small drift model; in production it reads net value from live SoDEX positions."
                  />
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px]">
              You can verify the live calls yourself in real time on the{" "}
              <Link href="/diag" className="text-brand-600 underline-offset-4 hover:underline dark:text-brand-300">
                diagnostics page
              </Link>
              .
            </p>
          </Section>

          <Section id="testnet" icon={ShieldCheck} title="Expected behaviour on testnet">
            <ul className="space-y-2">
              <li>
                The app defaults to <code className="font-mono text-foreground">MOSAIC_NETWORK=testnet</code>.
                The navbar badge shows the active network.
              </li>
              <li>
                No seed phrase or deposit is required to run the full thesis → basket → backtest →
                execute flow — execution is simulated on testnet.
              </li>
              <li>
                To see live SoDEX balances, connect a wallet and claim test USDC from the SoDEX
                faucet (linked in the dashboard health banner). Without a wallet, the portfolio shows
                a clearly-labelled demo state.
              </li>
              <li>
                If an upstream API is briefly unavailable, panels fall back to curated data rather
                than erroring — labelled accordingly.
              </li>
            </ul>
          </Section>

          <Section id="endpoints" icon={Radio} title="Endpoints actually called">
            <p>Representative calls and response shapes. Live status is verifiable at /diag.</p>
            <div className="mt-4 space-y-4">
              <div>
                <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  SoSoValue · base https://openapi.sosovalue.com
                </div>
                <div className="space-y-2">
                  <Endpoint
                    method="GET"
                    path="/api/v1/news/featured/currency"
                    note="Featured news, currency-filterable. Drives the landing feed, Market Pulse and rebalance citations."
                    sample={`{ "data": [ { "title": "…", "source": "…",\n  "publishedAt": "…", "tickers": ["BTC"],\n  "sentiment": 0.42 } ] }`}
                  />
                  <Endpoint
                    method="GET"
                    path="/api/v1/etf/spot/{asset}/flow"
                    note="Spot ETF net flows per asset (BTC, ETH, …). Drives the landing flow chart."
                    sample={`{ "data": [ { "date": "2026-06-03",\n  "netInflowUsd": 1.2e8,\n  "cumulativeUsd": 4.1e10 } ] }`}
                  />
                  <Endpoint
                    method="GET"
                    path="/api/v1/index/list  ·  /api/v1/index/{symbol}"
                    note="SSI index library and per-index composition. Powers the SSI basket loader and benchmark mapping (e.g. MAG7.ssi)."
                    sample={`{ "data": { "symbol": "MAG7.ssi",\n  "constituents": [ { "symbol": "BTC",\n  "weight": 0.34 } ], "changePct": 0.018 } }`}
                  />
                  <Endpoint
                    method="GET"
                    path="/api/v1/token/{symbol}/metrics"
                    note="Momentum, sentiment, volatility and liquidity used to score and weight the universe."
                    sample={`{ "data": { "symbol": "TAO",\n  "momentum30d": 0.21, "sentiment": 0.38,\n  "volatility": 0.74 } }`}
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  SoDEX · base https://testnet-gw.sodex.dev/api/v1/spot
                </div>
                <div className="space-y-2">
                  <Endpoint
                    method="GET"
                    path="/markets/symbols  ·  /markets/tickers"
                    note="Tradeable markets and 24h tickers. Routes any SoSoValue ticker to a SoDEX pair and prices the portfolio."
                    sample={`{ "code": 0, "data": [ { "symbol": "ETH_USDC",\n  "lastPrice": "3421.5", "open": "3300.0" } ] }`}
                  />
                  <Endpoint
                    method="GET"
                    path="/markets/{symbol}/orderbook?limit=8"
                    note="8 levels of depth per market. Feeds the real IOC slippage-bps estimate per leg."
                    sample={`{ "code": 0, "data": { "bids": [["3420.1","2.4"]],\n  "asks": [["3422.0","1.8"]] } }`}
                  />
                  <Endpoint
                    method="GET"
                    path="/accounts/{address}/balances"
                    note="Live testnet balances for a connected wallet, valued via /markets/tickers."
                    sample={`{ "code": 0, "data": [ { "asset": "USDC",\n  "free": "782.61", "locked": "0" } ] }`}
                  />
                  <Endpoint
                    method="POST"
                    path="/trade/orders/batch  (Wave 3)"
                    note="Multi-leg order placement. Simulated in the demo; EIP-712-signed on-chain writes land in Wave 3."
                    sample={`// simulated fill in demo:\n{ "filled": true, "legs": 5,\n  "avgSlippageBps": 41 }`}
                  />
                </div>
              </div>
            </div>
          </Section>
        </div>

        <div className="mt-12 rounded-xl border border-border/40 bg-card/60 dark:bg-card/30 p-5 text-sm">
          <p className="text-muted-foreground">
            Questions while judging? The full architecture, judging-rubric mapping and Wave-2
            changelog live in the repo&apos;s{" "}
            <Link
              href="https://github.com/janneh2000/mosaic"
              target="_blank"
              className="text-brand-600 underline-offset-4 hover:underline dark:text-brand-300"
            >
              README and WAVE2.md
            </Link>
            . Thanks for taking the time.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
