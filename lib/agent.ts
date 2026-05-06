// Mosaic agent: thesis -> theme classification -> scoring -> weighted basket.
//
// Two paths:
//   1) ANTHROPIC_API_KEY set      -> ask Claude to extract {themes, risk, constraints}
//                                     from the user's natural-language thesis.
//   2) Otherwise                  -> deterministic keyword classifier (works offline).
//
// Scoring is identical in both paths. Reasoning strings are templated.

import { z } from "zod";
import type { Basket, RiskLevel, Theme, Thesis, TokenScore } from "./types";
import { getCandidateUniverse, type TokenMetrics } from "./sosovalue";

const THEME_KEYWORDS: Record<Theme, string[]> = {
  "ai-infra": ["ai", "artificial intelligence", "machine learning", "compute", "gpu", "inference", "llm", "ml"],
  depin: ["depin", "physical infrastructure", "wireless", "storage network", "compute network"],
  "defi-bluechip": ["defi", "lending", "dex", "amm", "swap", "yield", "blue chip", "bluechip"],
  memes: ["meme", "memecoin", "shitcoin", "degen"],
  rwa: ["rwa", "real world", "real-world", "treasur", "bond", "tokenized stock"],
  "l2-scaling": ["l2", "layer 2", "rollup", "scaling", "optimistic", "zk-rollup"],
  custom: [],
};

const ThemeWeightsSchema = z.record(z.number());

interface AgentPlan {
  themes: Array<{ theme: Theme; weight: number }>;
  risk: RiskLevel;
  notes: string[];
}

function classifyByKeywords(thesis: Thesis): AgentPlan {
  const text = thesis.prompt.toLowerCase();
  const matches: Array<{ theme: Theme; weight: number }> = [];
  for (const [theme, kws] of Object.entries(THEME_KEYWORDS)) {
    if (theme === "custom") continue;
    const hits = kws.reduce((n, k) => (text.includes(k) ? n + 1 : n), 0);
    if (hits) matches.push({ theme: theme as Theme, weight: hits });
  }
  if (matches.length === 0) matches.push({ theme: "defi-bluechip", weight: 1 });
  const sum = matches.reduce((s, m) => s + m.weight, 0);
  return {
    themes: matches.map((m) => ({ theme: m.theme, weight: m.weight / sum })),
    risk: thesis.risk,
    notes: [`Classified by keyword match: ${matches.map((m) => m.theme).join(", ")}`],
  };
}

async function classifyByClaude(thesis: Thesis): Promise<AgentPlan | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system:
          "You are a portfolio architect. Extract crypto investment themes, risk, and constraints from a user thesis. " +
          "Allowed themes: ai-infra, depin, defi-bluechip, memes, rwa, l2-scaling. " +
          "Output JSON only with shape: {\"themes\":[{\"theme\":string,\"weight\":number}], \"risk\":\"conservative|balanced|aggressive\", \"notes\":string[]}.",
        messages: [{ role: "user", content: `Thesis: """${thesis.prompt}""". User-set risk: ${thesis.risk}. Amount: $${thesis.amountUsd}.` }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data.content?.[0]?.text ?? "";
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    ThemeWeightsSchema.parse(Object.fromEntries((json.themes ?? []).map((t: any) => [t.theme, t.weight])));
    return {
      themes: json.themes,
      risk: json.risk ?? thesis.risk,
      notes: json.notes ?? [],
    };
  } catch {
    return null;
  }
}

function scoreToken(t: TokenMetrics, plan: AgentPlan): { score: number; reasonBits: string[] } {
  const themeFit = plan.themes.reduce((s, p) => s + (t.themes.includes(p.theme) ? p.weight : 0), 0);
  if (themeFit === 0) return { score: 0, reasonBits: [] };

  const momentum = Math.max(-0.3, Math.min(0.5, t.momentum30d));
  const sentiment = Math.max(-1, Math.min(1, t.sentiment));
  const liq = Math.max(0.2, Math.min(1, t.liquidityScore));

  // Risk-adjust: aggressive likes momentum/vol, conservative likes liquidity/stability.
  const riskAdj =
    plan.risk === "aggressive"
      ? momentum * 1.4 + sentiment * 0.6 - 0
      : plan.risk === "conservative"
      ? momentum * 0.4 + sentiment * 0.4 + liq * 0.6 - t.volatility * 0.5
      : momentum * 0.9 + sentiment * 0.5 + liq * 0.3 - t.volatility * 0.2;

  const score = themeFit * 0.6 + riskAdj * 0.4 + 0.5; // baseline 0.5 so themeFit dominates
  const bits = [
    `${(themeFit * 100).toFixed(0)}% theme fit`,
    momentum >= 0.05 ? `+${(momentum * 100).toFixed(1)}% 30d momentum` : `${(momentum * 100).toFixed(1)}% 30d momentum`,
    sentiment >= 0.2 ? `bullish sentiment` : sentiment <= -0.2 ? `bearish sentiment` : `neutral sentiment`,
    liq >= 0.7 ? `deep SoDEX liquidity` : liq < 0.5 ? `thin liquidity (sized down)` : `adequate liquidity`,
  ];
  return { score: Math.max(0, score), reasonBits: bits };
}

function softmaxWeights(scores: number[], temperature = 0.5) {
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp((s - max) / temperature));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

/** Caps any single weight; redistributes the overflow proportionally. */
function capWeights(weights: number[], cap: number) {
  let w = [...weights];
  for (let iter = 0; iter < 6; iter++) {
    const overflow = w.reduce((s, x) => s + Math.max(0, x - cap), 0);
    if (overflow < 1e-9) break;
    w = w.map((x) => Math.min(x, cap));
    const totalUnder = w.reduce((s, x) => (x < cap ? s + x : s), 0);
    w = w.map((x) => (x < cap && totalUnder > 0 ? x + (overflow * x) / totalUnder : x));
  }
  const s = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / s);
}

export async function buildBasket(thesis: Thesis): Promise<Basket> {
  const plan = (await classifyByClaude(thesis)) ?? classifyByKeywords(thesis);
  const universe = await getCandidateUniverse();

  const ranked = universe
    .map((t) => ({ token: t, ...scoreToken(t, plan) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  // Pick top N by risk profile
  const N = thesis.risk === "conservative" ? 4 : thesis.risk === "aggressive" ? 8 : 6;
  const top = ranked.slice(0, N);

  if (top.length === 0) {
    // Fall back to defi-bluechip basket
    const defaults = universe.filter((t) => t.themes.includes("defi-bluechip")).slice(0, 4);
    top.push(
      ...defaults.map((t) => ({ token: t, score: 1, reasonBits: ["fallback bluechip allocation"] })),
    );
  }

  const cap = thesis.risk === "conservative" ? 0.3 : thesis.risk === "aggressive" ? 0.45 : 0.35;
  const rawWeights = softmaxWeights(top.map((r) => r.score), thesis.risk === "aggressive" ? 0.35 : 0.55);
  const finalWeights = capWeights(rawWeights, cap);

  const rawConstituents: TokenScore[] = top.map((r, i) => ({
    symbol: r.token.symbol,
    name: r.token.name,
    weight: +finalWeights[i].toFixed(4),
    rationale: r.reasonBits.join(" • "),
    metrics: {
      marketCap: r.token.marketCap,
      momentum30d: r.token.momentum30d,
      sentiment: r.token.sentiment,
      volatility: r.token.volatility,
      liquidityScore: r.token.liquidityScore,
    },
  }));
  // Drop near-zero rounded weights and renormalize so every leg in the
  // execution plan is fillable.
  const survivors = rawConstituents.filter((c) => c.weight > 0.001);
  const total = survivors.reduce((s, c) => s + c.weight, 0);
  const constituents: TokenScore[] = survivors.map((c) => ({
    ...c,
    weight: +(c.weight / total).toFixed(4),
  }));

  // Risk score: weighted volatility, scaled.
  const expectedVol = constituents.reduce((s, c) => s + c.weight * (c.metrics.volatility ?? 0.6), 0);
  const concentration = constituents.reduce((s, c) => s + c.weight ** 2, 0);
  const riskScore = Math.round(Math.min(100, expectedVol * 70 + concentration * 60));

  const benchmark =
    plan.themes[0]?.theme === "ai-infra"
      ? { symbol: "AI.ssi", name: "AI Infrastructure SSI" }
      : plan.themes[0]?.theme === "defi-bluechip"
      ? { symbol: "DEFI.ssi", name: "DEFI SSI" }
      : plan.themes[0]?.theme === "memes"
      ? { symbol: "MEME.ssi", name: "MEME SSI" }
      : undefined;

  const reasoning = [
    `Thesis decomposed into ${plan.themes
      .map((t) => `${(t.weight * 100).toFixed(0)}% ${t.theme}`)
      .join(" + ")}.`,
    `Selected ${constituents.length} constituents by theme fit, momentum, sentiment and SoDEX liquidity.`,
    `Caps applied: max single weight ${(cap * 100).toFixed(0)}% (${thesis.risk}).`,
    benchmark ? `Benchmarked against SoSoValue ${benchmark.symbol}.` : "",
    ...plan.notes.map((n) => `Note: ${n}`),
  ]
    .filter(Boolean)
    .join(" ");

  return {
    id: `basket-${Date.now()}`,
    thesis,
    constituents,
    riskScore,
    expectedAnnualVol: +expectedVol.toFixed(2),
    reasoning,
    createdAt: new Date().toISOString(),
    benchmark,
  };
}
