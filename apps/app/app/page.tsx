"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { ThesisInput } from "@/components/dashboard/ThesisInput";
import { BasketProposal } from "@/components/dashboard/BasketProposal";
import { ExecutionPreview } from "@/components/dashboard/ExecutionPreview";
import { Portfolio } from "@/components/dashboard/Portfolio";
import { AgentLog, type LogStep } from "@/components/dashboard/AgentLog";
import { BacktestPanel } from "@/components/dashboard/BacktestPanel";
import { MonteCarloPanel } from "@/components/dashboard/MonteCarloPanel";
import { StressTestPanel } from "@/components/dashboard/StressTestPanel";
import { MyBaskets } from "@/components/dashboard/MyBaskets";
import { ProductTour } from "@/components/dashboard/ProductTour";
import { HealthBanner } from "@/components/dashboard/HealthBanner";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { SsiBrowser } from "@/components/dashboard/SsiBrowser";
import { MarketPulse } from "@/components/dashboard/MarketPulse";
import { MandateCard } from "@/components/dashboard/MandateCard";
import {
  useUiMode,
  ModeToggle,
  GuidedStep,
  useDeskShortcuts,
  ShortcutSheet,
  type DeskShortcut,
} from "@/components/dashboard/UiMode";
import { Button } from "@mosaic/ui/button";
import type { Basket, ExecutionPlan, RiskLevel } from "@mosaic/core/types";
import type { BacktestResult } from "@mosaic/core/backtest";
import type { MonteCarloResult } from "@mosaic/core/montecarlo";
import type { ScenarioResult } from "@mosaic/core/scenarios";
import { sleep } from "@mosaic/core/utils";
import { track } from "@/lib/analytics";
import { HelpCircle, AlertTriangle, X } from "lucide-react";

export default function AppPage() {
  const [loading, setLoading] = useState(false);
  const [basket, setBasket] = useState<Basket | null>(null);
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [steps, setSteps] = useState<LogStep[]>([]);
  const [backtest, setBacktest] = useState<BacktestResult | null>(null);
  const [mc, setMc] = useState<MonteCarloResult | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioResult[] | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tourOpen, setTourOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track the last-used amount/risk so the SsiBrowser can mirror them.
  const [lastAmount, setLastAmount] = useState(1000);
  const [lastRisk, setLastRisk] = useState<RiskLevel>("balanced");

  // Guided (progressive stepper) vs Desk (dense grid + keyboard). One data
  // layer, two compositions — dual-mode-ui spec.
  const { mode, setMode } = useUiMode();
  const isDesk = (mode ?? "desk") === "desk";

  const scrollToPanel = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const deskShortcuts: DeskShortcut[] = [
    {
      key: "t",
      label: "Focus thesis input",
      run: () => {
        scrollToPanel("panel-thesis");
        (document.querySelector('[data-tour="thesis"] textarea') as HTMLTextAreaElement | null)?.focus();
      },
    },
    { key: "1", label: "Jump to thesis", run: () => scrollToPanel("panel-thesis") },
    { key: "2", label: "Jump to proposal", run: () => scrollToPanel("panel-basket") },
    { key: "3", label: "Jump to analysis", run: () => scrollToPanel("panel-analysis") },
    { key: "4", label: "Jump to execution", run: () => scrollToPanel("panel-execute") },
    { key: "5", label: "Jump to my baskets", run: () => scrollToPanel("panel-baskets") },
    { key: "6", label: "Jump to portfolio", run: () => scrollToPanel("panel-portfolio") },
  ];
  const { sheetOpen, setSheetOpen } = useDeskShortcuts(isDesk, deskShortcuts);

  function onSsiLoaded(data: { basket: Basket; plan: ExecutionPlan }) {
    // Mirror what onSubmit would have produced — keeps the rest of the UI
    // (Backtest / Monte Carlo / Stress / Execution) wired up identically.
    setBasket(data.basket);
    setPlan(data.plan);
    setSteps([
      { id: "parse", label: "Loaded SoSoValue SSI composition", status: "done" },
      { id: "score", label: "Inherited target weights from index", status: "done" },
      { id: "weight", label: "Risk-adjusted to your profile", status: "done" },
      { id: "depth", label: "Queried SoDEX orderbook depth for each leg", status: "done" },
      { id: "plan", label: `Total est. slippage: ${data.plan.estTotalSlippageBps} bps`, status: "done" },
    ]);
    runAnalysis(data.basket);
    // Scroll the basket into view so the result is seen immediately.
    if (typeof window !== "undefined") {
      setTimeout(() => {
        document.querySelector('[data-tour="basket"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }

  async function runAnalysis(b: Basket) {
    setAnalysing(true);
    setBacktest(null);
    setMc(null);
    setScenarios(null);
    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basket: b, horizonDays: 90 }),
      });
      if (res.ok) {
        track("backtest_run");
        const data = await res.json();
        setBacktest(data.backtest);
        setMc(data.monteCarlo);
        setScenarios(data.scenarios);
      }
    } finally {
      setAnalysing(false);
    }
  }

  async function onSubmit(input: { prompt: string; amountUsd: number; risk: RiskLevel }) {
    track("thesis_submitted", { risk: input.risk, amountUsd: input.amountUsd });
    setLoading(true);
    setLastAmount(input.amountUsd);
    setLastRisk(input.risk);
    setBasket(null);
    setPlan(null);
    setBacktest(null);
    setMc(null);
    setScenarios(null);

    const seq: LogStep[] = [
      { id: "parse", label: "Parsing thesis", status: "running" },
      { id: "score", label: "Scoring candidates with SoSoValue metrics + sentiment", status: "pending" },
      { id: "weight", label: "Constructing risk-adjusted weights", status: "pending" },
      { id: "depth", label: "Querying SoDEX orderbook depth for each leg", status: "pending" },
      { id: "plan", label: "Building IOC execution plan", status: "pending" },
    ];
    setSteps(seq);

    const advance = async (id: string, detail?: string) => {
      await sleep(550);
      setSteps((curr) =>
        curr.map((s) => {
          if (s.id === id) return { ...s, status: "done", detail };
          const idx = curr.findIndex((x) => x.id === id);
          const myIdx = curr.findIndex((x) => x.id === s.id);
          if (myIdx === idx + 1) return { ...s, status: "running" };
          return s;
        })
      );
    };

    const reqPromise = fetch("/api/thesis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => r.json());

    await advance("parse", `Themes inferred from "${input.prompt.slice(0, 40)}…"`);
    await advance("score", "Universe scored on momentum, sentiment, liquidity");
    await advance("weight", `Risk profile: ${input.risk}, concentration cap applied`);
    await advance("depth", "8 levels per market, IOC fill simulated");

    let result: { basket?: Basket; plan?: ExecutionPlan } | null = null;
    try {
      result = await reqPromise;
    } catch {
      result = null;
    }
    if (result && result.basket && result.plan) {
      track("basket_proposed", { constituents: result.basket.constituents.length });
      setBasket(result.basket);
      setPlan(result.plan);
      await advance("plan", `Total est. slippage: ${result.plan.estTotalSlippageBps} bps`);
      // Kick off backtest / MC / scenarios in parallel with the user reviewing.
      runAnalysis(result.basket);
      // Bring the freshly-built basket into view (matters for one-click demos).
      if (typeof window !== "undefined") {
        setTimeout(() => {
          document
            .querySelector('[data-tour="basket"]')
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 120);
      }
    } else {
      // Surface the failure instead of leaving the button stuck.
      setSteps([]);
      setError("Couldn't build a basket from that thesis. Please try again in a moment.");
    }
    setLoading(false);
  }

  // Auto-dismiss the error toast.
  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(id);
  }, [error]);

  // One-click mirror entry point: /app?mirror=<slug>&notional=<usd> lands
  // here from a public basket page. The server returns the public basket's
  // exact weights scaled to the visitor's notional + a fresh SoDEX plan, and
  // the normal proposal → analysis → confirm-gated pipeline takes over.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("mirror");
    if (!slug) return;
    const notional = Math.max(10, Number(params.get("notional")) || 1000);
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/mirror", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, amountUsd: notional }),
        });
        if (!res.ok) throw new Error("mirror failed");
        const data: { basket: Basket; plan: ExecutionPlan } = await res.json();
        track("basket_mirrored", { slug, notional });
        setLastAmount(notional);
        onSsiLoaded({ basket: data.basket, plan: data.plan });
        setSteps([
          { id: "parse", label: `Loaded public basket "${slug}"`, status: "done" },
          { id: "score", label: "Copied exact weights (mirror)", status: "done" },
          { id: "weight", label: `Scaled to $${notional.toLocaleString()}`, status: "done" },
          { id: "depth", label: "Queried SoDEX orderbook depth for each leg", status: "done" },
          { id: "plan", label: `Total est. slippage: ${data.plan.estTotalSlippageBps} bps`, status: "done" },
        ]);
      } catch {
        setError("Couldn't load that public basket to mirror. It may have been unpublished.");
      } finally {
        setLoading(false);
        // Clean the URL so refreshes don't re-trigger the mirror.
        window.history.replaceState(null, "", "/");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Snapshot poll: every time we land on the dashboard, push a t-now snapshot
  // for any saved basket so the realised-return curve fills in.
  // When the durable backend is active the server-side cron owns snapshots,
  // so the client-side drift model stays off entirely.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getSession } = await import("@mosaic/core/wallet");
        const { HOUSE_OWNER, listBaskets, appendSnapshot, probeServer } = await import("@mosaic/core/storage");
        if (await probeServer()) return; // server snapshotter owns the series
        if (cancelled) return;
        const owner = getSession()?.address ?? HOUSE_OWNER;
        const saved = listBaskets(owner).filter((b) => b.status === "active");
        for (const b of saved) {
          if (cancelled) return;
          // Mock realised value: drift execution notional by a small random walk.
          // In production this is portfolio.netValueUsd from SoDEX positions.
          const days = Math.max(
            0.01,
            (Date.now() - new Date(b.execution.executedAt).getTime()) / (24 * 3600 * 1000),
          );
          const driftPct = (Math.sin(days * 7 + b.basket.id.length) * 0.04 + days * 0.002) ;
          const mv = b.execution.notionalUsd * (1 + driftPct);
          appendSnapshot(owner, {
            basketId: b.basket.id,
            takenAt: new Date().toISOString(),
            marketValueUsd: +mv.toFixed(2),
            pnlUsd: +(mv - b.execution.notionalUsd).toFixed(2),
            pnlPct: +driftPct.toFixed(4),
          });
        }
      } catch {
        // ignore — storage / wallet are best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // ---- Shared panels (single source; both modes compose these) ----
  const thesisPanel = (
    <div data-tour="thesis" id="panel-thesis">
      <ThesisInput onSubmit={onSubmit} loading={loading} />
    </div>
  );
  const ssiPanel = (
    <SsiBrowser amountUsd={lastAmount} risk={lastRisk} onLoaded={onSsiLoaded} />
  );
  const proposalPanel = basket && (
    <div data-tour="basket" id="panel-basket">
      <BasketProposal basket={basket} />
    </div>
  );
  const analysisPanel = basket && (
    <div data-tour="analysis" id="panel-analysis" className="tile-in space-y-6">
      {analysing && !backtest && (
        <div className="rounded-md border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">
          Running backtest + Monte Carlo + scenario stress tests…
        </div>
      )}
      {backtest && <BacktestPanel result={backtest} />}
      {mc && <MonteCarloPanel result={mc} />}
      {scenarios && <StressTestPanel results={scenarios} />}
    </div>
  );
  const executePanel = plan && basket && (
    <div data-tour="execute" id="panel-execute">
      <ExecutionPreview plan={plan} basket={basket} onExecuted={() => setRefreshKey((k) => k + 1)} />
    </div>
  );
  const basketsPanel = (
    <div id="panel-baskets">
      <MyBaskets key={refreshKey} />
    </div>
  );
  const portfolioPanel = (
    <div id="panel-portfolio">
      <Portfolio />
    </div>
  );
  const agentLogPanel = steps.length > 0 && (
    <div data-tour="agent">
      <AgentLog steps={steps} />
    </div>
  );
  const mandatePanel = <MandateCard basket={basket} amountUsd={lastAmount} />;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-content px-4 pt-6 pb-24 sm:px-6 sm:pt-10">
        <div className="tile-in mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
          <div className="min-w-0">
            <p className="brand-eyebrow brand-caret" style={{ color: "var(--cyan)" }}>
              mosaic://agent_console
            </p>
            <h1 className="mt-1.5 text-headline-md tracking-tight sm:text-headline-lg">
              Mosaic agent
            </h1>
            <p className="mt-2 max-w-xl text-body-md text-on-surface-variant">
              {isDesk
                ? "Thesis → basket → backtest → execution → portfolio. Press ? for shortcuts."
                : "Five steps from an idea to a tracked, on-chain basket."}
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-surface-container p-1 shadow-elevation-1">
            <ModeToggle mode={mode} onChange={setMode} />
            {isDesk && (
              <Button variant="ghost" size="sm" onClick={() => setTourOpen(true)}>
                <HelpCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Replay tour</span>
              </Button>
            )}
          </div>
        </div>

        <HealthBanner />

        {isDesk ? (
          <>
            <div className="mt-4">
              <OnboardingChecklist />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <div className="tile-stagger space-y-6">
                {thesisPanel}
                {ssiPanel}
                {proposalPanel}
                {analysisPanel}
                {executePanel}
                {basketsPanel}
                {portfolioPanel}
              </div>

              <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
                <MarketPulse />
                {mandatePanel}
                {agentLogPanel}
                <div className="rounded-md border border-outline-variant bg-surface-container-low p-4">
                  <div className="mb-2 brand-label">
                    Mode
                  </div>
                  <p className="text-sm leading-relaxed">
                    Demo mode runs against testnet + mock fallbacks — nothing to configure. Set
                    <span className="mx-1 rounded bg-surface-container px-1 py-0.5 font-mono text-xs">
                      SOSOVALUE_API_KEY
                    </span>
                    and
                    <span className="mx-1 rounded bg-surface-container px-1 py-0.5 font-mono text-xs">
                      SODEX_API_KEY
                    </span>
                    in
                    <span className="mx-1 rounded bg-surface-container px-1 py-0.5 font-mono text-xs">
                      .env.local
                    </span>
                    to flip into live mode. Toggle
                    <span className="mx-1 rounded bg-surface-container px-1 py-0.5 font-mono text-xs">
                      MOSAIC_NETWORK=mainnet
                    </span>
                    only after depositing collateral per the SoDEX docs.
                  </p>
                  <a
                    href="https://sosovalue.gitbook.io/soso-value-api-doc"
                    target="_blank"
                    className="mt-3 inline-block text-xs text-primary underline-offset-4 hover:underline"
                  >
                    SoSoValue API docs →
                  </a>
                  <a
                    href="https://sodex.com/documentation/api/api"
                    target="_blank"
                    className="mt-1 inline-block text-xs text-primary underline-offset-4 hover:underline"
                  >
                    SoDEX API docs →
                  </a>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="mx-auto mt-8 max-w-3xl tile-stagger space-y-10">
            <GuidedStep
              step={1}
              title="Describe your thesis"
              description="Plain English is enough — the agent turns it into a weighted basket. Or start from a SoSoValue index below."
              done={Boolean(basket)}
            >
              {thesisPanel}
              {!basket && ssiPanel}
            </GuidedStep>

            {basket && (
              <GuidedStep
                step={2}
                title="Review the proposal"
                description="Every constituent carries its reasoning — theme fit, momentum, sentiment, and liquidity."
                done={Boolean(plan)}
              >
                {proposalPanel}
                {agentLogPanel}
              </GuidedStep>
            )}

            {basket && (
              <GuidedStep
                step={3}
                title="Check the risk"
                description="Backtest, 1,000-path Monte Carlo, and three historical stress tests — before any money moves."
                done={Boolean(backtest)}
              >
                {analysisPanel}
              </GuidedStep>
            )}

            {plan && basket && (
              <GuidedStep
                step={4}
                title="Execute — you stay in control"
                description="Nothing is placed without your confirm. On mainnet, execution also needs your signed mandate."
                done={refreshKey > 0}
              >
                {executePanel}
                {mandatePanel}
              </GuidedStep>
            )}

            <GuidedStep
              step={5}
              title="Track your record"
              description="Saved baskets snapshot daily server-side, hash-chained so the history is verifiable. Publish one to share it."
            >
              {basketsPanel}
              {portfolioPanel}
            </GuidedStep>

            <details className="rounded-md border border-outline-variant bg-surface-container-low p-4">
              <summary className="cursor-pointer text-title-md text-on-surface">
                Market context
              </summary>
              <div className="mt-4">
                <MarketPulse />
              </div>
            </details>
          </div>
        )}
      </main>

      {/* Error toast — no silent failures */}
      {error && (
        <div className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4">
          <div className="flex items-start gap-3 rounded-md border border-error/30 bg-surface-container-low p-3 pr-2 text-sm shadow-elevation-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-error" />
            <span className="max-w-xs text-on-surface">{error}</span>
            <button
              onClick={() => setError(null)}
              aria-label="Dismiss"
              className="rounded p-0.5 text-on-surface-variant transition hover:text-on-surface"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <ShortcutSheet open={sheetOpen} onClose={() => setSheetOpen(false)} shortcuts={deskShortcuts} />

      {/* The overlay tour targets Desk-mode anchors; Guided mode IS the tour. */}
      {(isDesk || tourOpen) && (
        <ProductTour forceOpen={tourOpen} onClose={() => setTourOpen(false)} />
      )}
    </>
  );
}
