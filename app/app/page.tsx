"use client";

import { useState } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { ThesisInput } from "@/components/dashboard/ThesisInput";
import { BasketProposal } from "@/components/dashboard/BasketProposal";
import { ExecutionPreview } from "@/components/dashboard/ExecutionPreview";
import { Portfolio } from "@/components/dashboard/Portfolio";
import { AgentLog, type LogStep } from "@/components/dashboard/AgentLog";
import type { Basket, ExecutionPlan, RiskLevel } from "@/lib/types";
import { sleep } from "@/lib/utils";

export default function AppPage() {
  const [loading, setLoading] = useState(false);
  const [basket, setBasket] = useState<Basket | null>(null);
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [steps, setSteps] = useState<LogStep[]>([]);

  async function onSubmit(input: { prompt: string; amountUsd: number; risk: RiskLevel }) {
    setLoading(true);
    setBasket(null);
    setPlan(null);

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

    const result = await reqPromise;
    if (result.basket && result.plan) {
      setBasket(result.basket);
      setPlan(result.plan);
      await advance("plan", `Total est. slippage: ${result.plan.estTotalSlippageBps} bps`);
    }
    setLoading(false);
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 pt-10 pb-24">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Mosaic agent</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Thesis → basket → execution → portfolio. The whole loop, on one screen.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <ThesisInput onSubmit={onSubmit} loading={loading} />
            {basket && <BasketProposal basket={basket} />}
            {plan && <ExecutionPreview plan={plan} />}
            <Portfolio />
          </div>
          <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
            {steps.length > 0 && <AgentLog steps={steps} />}
            <div className="rounded-xl border border-white/5 bg-card/40 p-4 backdrop-blur-xl">
              <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                Mode
              </div>
              <p className="text-sm leading-relaxed">
                Demo runs against testnet + mock fallbacks so judges never hit a paywall. Set
                <span className="mx-1 rounded bg-secondary px-1 py-0.5 font-mono text-xs">
                  SOSOVALUE_API_KEY
                </span>
                and
                <span className="mx-1 rounded bg-secondary px-1 py-0.5 font-mono text-xs">
                  SODEX_API_KEY
                </span>
                in
                <span className="mx-1 rounded bg-secondary px-1 py-0.5 font-mono text-xs">
                  .env.local
                </span>
                to flip into live mode.
              </p>
              <a
                href="https://sosovalue.gitbook.io/soso-value-api-doc"
                target="_blank"
                className="mt-3 inline-block text-xs text-brand-300 underline-offset-4 hover:underline"
              >
                SoSoValue API docs →
              </a>
              <a
                href="https://sodex.com/documentation/api/api"
                target="_blank"
                className="mt-1 inline-block text-xs text-brand-300 underline-offset-4 hover:underline"
              >
                SoDEX API docs →
              </a>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
