"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Wand2 } from "lucide-react";
import type { RiskLevel } from "@/lib/types";

const PRESETS = [
  "I want exposure to AI-infrastructure with $1,000 and moderate risk.",
  "Build me a DePIN basket — about $2,500, balanced risk.",
  "DeFi blue chips only. Conservative. Five thousand dollars.",
  "Aggressive memecoin trade, $500. Yes I know what I'm doing.",
  "Tokenized RWA exposure with bias toward yield. $3,000, balanced.",
];

interface Props {
  onSubmit: (input: { prompt: string; amountUsd: number; risk: RiskLevel }) => void;
  loading: boolean;
}

export function ThesisInput({ onSubmit, loading }: Props) {
  const [prompt, setPrompt] = useState(PRESETS[0]);
  const [amount, setAmount] = useState(1000);
  const [risk, setRisk] = useState<RiskLevel>("balanced");

  return (
    <Card className="ring-glow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-300" />
          Tell Mosaic your thesis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
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
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setPrompt(p)}
                className="rounded-full border border-white/5 bg-background/40 px-3 py-1 text-xs text-muted-foreground transition hover:border-white/15 hover:text-foreground"
              >
                {p.slice(0, 38)}
                {p.length > 38 ? "…" : ""}
              </button>
            ))}
          </div>
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
              <span className="w-24 rounded-md border border-input bg-background/40 px-3 py-1.5 text-right text-sm font-mono">
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
                      ? "border-brand-500/40 bg-brand-500/10 text-brand-200"
                      : "border-white/5 bg-background/40 text-muted-foreground hover:border-white/15"
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
