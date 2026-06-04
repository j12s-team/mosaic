"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Wand2,
  Cpu,
  Landmark,
  Radio,
  Rocket,
  Layers,
  Building2,
  Zap,
} from "lucide-react";
import type { RiskLevel } from "@/lib/types";

interface DemoThesis {
  label: string;
  sub: string;
  prompt: string;
  amountUsd: number;
  risk: RiskLevel;
  Icon: typeof Cpu;
}

/**
 * One-click sample theses. Each fills the prompt + amount + risk and submits
 * immediately, so a judge gets a fully-populated basket + backtest in seconds
 * with zero setup.
 */
const DEMOS: DemoThesis[] = [
  {
    label: "AI Infrastructure",
    sub: "$1,000 · balanced",
    prompt: "AI-infrastructure exposure — compute, inference and agent tokens. $1,000, balanced risk.",
    amountUsd: 1000,
    risk: "balanced",
    Icon: Cpu,
  },
  {
    label: "DeFi Bluechip",
    sub: "$5,000 · conservative",
    prompt: "DeFi blue chips only — established lending and DEX protocols. $5,000, conservative.",
    amountUsd: 5000,
    risk: "conservative",
    Icon: Landmark,
  },
  {
    label: "DePIN",
    sub: "$2,500 · balanced",
    prompt: "DePIN basket — decentralized physical infrastructure networks. $2,500, balanced risk.",
    amountUsd: 2500,
    risk: "balanced",
    Icon: Radio,
  },
  {
    label: "Memecoins",
    sub: "$500 · aggressive",
    prompt: "Aggressive memecoin trade. $500. Yes, I know what I'm doing.",
    amountUsd: 500,
    risk: "aggressive",
    Icon: Rocket,
  },
  {
    label: "Mirror MAG7.ssi",
    sub: "$3,000 · balanced",
    prompt: "Mirror the MAG7.ssi index — the largest crypto majors. $3,000, balanced.",
    amountUsd: 3000,
    risk: "balanced",
    Icon: Layers,
  },
  {
    label: "RWA",
    sub: "$3,000 · balanced",
    prompt: "Tokenized real-world assets with a bias toward yield. $3,000, balanced.",
    amountUsd: 3000,
    risk: "balanced",
    Icon: Building2,
  },
];

interface Props {
  onSubmit: (input: { prompt: string; amountUsd: number; risk: RiskLevel }) => void;
  loading: boolean;
}

export function ThesisInput({ onSubmit, loading }: Props) {
  const [prompt, setPrompt] = useState(DEMOS[0].prompt);
  const [amount, setAmount] = useState(1000);
  const [risk, setRisk] = useState<RiskLevel>("balanced");

  function runDemo(d: DemoThesis) {
    if (loading) return;
    setPrompt(d.prompt);
    setAmount(d.amountUsd);
    setRisk(d.risk);
    onSubmit({ prompt: d.prompt, amountUsd: d.amountUsd, risk: d.risk });
  }

  return (
    <Card className="ring-glow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-600 dark:text-brand-300" />
          Tell Mosaic your thesis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* One-click demo theses — zero setup for judges */}
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-brand-700 dark:text-brand-200">
            <Zap className="h-3.5 w-3.5" />
            Try a sample thesis
            <span className="font-normal text-muted-foreground">— one click, builds instantly</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {DEMOS.map((d) => (
              <button
                key={d.label}
                onClick={() => runDemo(d)}
                disabled={loading}
                className="group flex items-center gap-2.5 rounded-lg border border-border/50 bg-secondary/30 dark:bg-background/40 px-3 py-2.5 text-left transition hover:border-brand-500/50 hover:bg-brand-500/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-md bg-brand-500/15 text-brand-600 transition group-hover:bg-brand-500/25 dark:text-brand-300">
                  <d.Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium">{d.label}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">{d.sub}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-border/40" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-card px-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              or write your own
            </span>
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">
            Plain English thesis
          </label>
          <Textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what exposure you want, how much, and your risk tolerance."
            className="mt-2"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">
              Amount (USDC)
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="range"
                min={100}
                max={10000}
                step={100}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="flex-1 accent-brand-400"
              />
              <span className="w-24 rounded-md border border-input bg-secondary/30 dark:bg-background/40 px-3 py-1.5 text-right text-sm font-mono">
                ${amount.toLocaleString()}
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">
              Risk profile
            </label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(["conservative", "balanced", "aggressive"] as RiskLevel[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRisk(r)}
                  className={`rounded-md border px-3 py-1.5 text-xs capitalize transition ${
                    risk === r
                      ? "border-brand-500/40 bg-brand-500/10 text-brand-700 dark:text-brand-200"
                      : "border-border/40 bg-secondary/30 dark:bg-background/40 text-muted-foreground hover:border-white/15"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              SoSoValue API
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              SoDEX testnet
            </Badge>
            <Badge variant="brand" className="text-[10px]">
              Agentic
            </Badge>
          </div>
          <Button
            disabled={loading || prompt.length < 8}
            onClick={() => onSubmit({ prompt, amountUsd: amount, risk })}
          >
            <Wand2 className="h-4 w-4" />
            {loading ? "Building basket…" : "Build my basket"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
