"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Sparkles,
  Check,
  ShieldCheck,
  History,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

/**
 * ProductPreview — a self-playing, dependency-free* storyboard of the core
 * Mosaic loop: thesis -> agent -> basket -> backtest & execute. It loops on a
 * timer so judges grasp the whole product in ~10 seconds without clicking.
 *
 * (*framer-motion is already a project dependency; no new packages added.)
 * Honors prefers-reduced-motion by showing the basket frame statically.
 */

const PHASES = ["Thesis", "Agent", "Basket", "Backtest & execute"] as const;

const THESIS = "AI-infrastructure exposure — $1,000, balanced risk.";

const LOG = [
  "Parsed thesis → theme: AI-infra",
  "Scored 20+ tokens on SoSoValue momentum + sentiment",
  "Applied concentration caps → 5 constituents",
  "Routed each leg through SoDEX orderbook depth",
];

const BASKET: { sym: string; name: string; w: number; grad: string }[] = [
  { sym: "TAO", name: "Bittensor", w: 32, grad: "from-brand-300 to-brand-500" },
  { sym: "RENDER", name: "Render", w: 24, grad: "from-violet-300 to-violet-500" },
  { sym: "FET", name: "Artificial SF", w: 20, grad: "from-emerald-300 to-emerald-500" },
  { sym: "AKT", name: "Akash", w: 14, grad: "from-amber-300 to-amber-500" },
  { sym: "GRASS", name: "Grass", w: 10, grad: "from-pink-300 to-pink-500" },
];

const STATS = [
  { k: "Sharpe", v: "1.42", tone: "pos" as const },
  { k: "Max drawdown", v: "−17.8%", tone: "neg" as const },
  { k: "vs MAG7.ssi", v: "+6.3%", tone: "pos" as const },
];

const PHASE_MS = 3000;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col justify-center px-4 py-4 sm:px-6">
      {children}
    </div>
  );
}

export function ProductPreview() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState(reduce ? 2 : 0);
  const [typed, setTyped] = useState(reduce ? THESIS : "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Phase cycler.
  useEffect(() => {
    if (reduce) return;
    timer.current = setTimeout(
      () => setPhase((p) => (p + 1) % PHASES.length),
      phase === 0 ? PHASE_MS + 600 : PHASE_MS,
    );
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [phase, reduce]);

  // Typewriter for the thesis phase.
  useEffect(() => {
    if (reduce) return;
    if (phase !== 0) return;
    setTyped("");
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(THESIS.slice(0, i));
      if (i >= THESIS.length) clearInterval(id);
    }, 28);
    return () => clearInterval(id);
  }, [phase, reduce]);

  return (
    <div className="ring-glow w-full rounded-2xl border border-border/50 bg-card/80 dark:bg-card/40 p-2 backdrop-blur-xl">
      {/* window chrome */}
      <div className="flex items-center gap-2 px-2 py-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        <span className="ml-2 rounded-md bg-secondary/60 dark:bg-background/50 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
          mosaic.app / agent
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          live demo
        </span>
      </div>

      {/* stage */}
      <div className="relative h-[300px] overflow-hidden rounded-xl border border-border/40 bg-secondary/20 dark:bg-background/30 sm:h-[280px]">
        <AnimatePresence mode="wait">
          {phase === 0 && (
            <motion.div
              key="thesis"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0"
            >
              <Frame>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Sparkles className="mr-1 inline h-3 w-3 text-brand-500" />
                  Tell Mosaic your thesis
                </div>
                <div className="mt-3 min-h-[88px] rounded-lg border border-border/50 bg-card/70 dark:bg-card/40 p-4 text-sm leading-relaxed sm:text-base">
                  {typed}
                  <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-brand-500 align-middle" />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex gap-2">
                    <span className="rounded-md border border-border/50 bg-secondary/40 dark:bg-background/40 px-2 py-1 text-[10px] text-muted-foreground">
                      $1,000
                    </span>
                    <span className="rounded-md border border-brand-500/40 bg-brand-500/10 px-2 py-1 text-[10px] text-brand-700 dark:text-brand-200">
                      balanced
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white">
                    Build my basket <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Frame>
            </motion.div>
          )}

          {phase === 1 && (
            <motion.div
              key="agent"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0"
            >
              <Frame>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Agent log
                </div>
                <div className="mt-3 space-y-2">
                  {LOG.map((line, i) => (
                    <motion.div
                      key={line}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 + i * 0.45 }}
                      className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/60 dark:bg-card/30 px-3 py-2 text-xs"
                    >
                      <span className="grid h-4 w-4 flex-shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                        <Check className="h-2.5 w-2.5" />
                      </span>
                      <span className="text-muted-foreground">{line}</span>
                    </motion.div>
                  ))}
                </div>
              </Frame>
            </motion.div>
          )}

          {phase === 2 && (
            <motion.div
              key="basket"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0"
            >
              <Frame>
                <div className="flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    <ShieldCheck className="mr-1 inline h-3 w-3 text-brand-500" />
                    Proposed basket
                  </div>
                  <div className="flex gap-1.5">
                    <span className="rounded-full border border-brand-500/40 bg-brand-500/10 px-2 py-0.5 text-[10px] text-brand-700 dark:text-brand-200">
                      vs AI.ssi
                    </span>
                    <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                      Moderate · 48/100
                    </span>
                  </div>
                </div>

                {/* weight bar */}
                <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full ring-1 ring-white/5">
                  {BASKET.map((c, i) => (
                    <motion.div
                      key={c.sym}
                      initial={{ width: 0 }}
                      animate={{ width: `${c.w}%` }}
                      transition={{ delay: 0.1 + i * 0.12, duration: 0.5, ease: "easeOut" }}
                      className={`bg-gradient-to-r ${c.grad}`}
                    />
                  ))}
                </div>

                {/* constituent chips, staggered */}
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {BASKET.map((c, i) => (
                    <motion.div
                      key={c.sym}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 + i * 0.12 }}
                      className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/60 dark:bg-card/30 px-2.5 py-1.5"
                    >
                      <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full bg-gradient-to-r ${c.grad}`} />
                      <span className="text-xs font-medium">{c.sym}</span>
                      <span className="ml-auto font-mono text-[11px] text-muted-foreground">{c.w}%</span>
                    </motion.div>
                  ))}
                </div>
              </Frame>
            </motion.div>
          )}

          {phase === 3 && (
            <motion.div
              key="exec"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0"
            >
              <Frame>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <History className="mr-1 inline h-3 w-3 text-brand-500" />
                  90-day backtest
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {STATS.map((s, i) => (
                    <motion.div
                      key={s.k}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.1 }}
                      className="rounded-lg border border-border/40 bg-card/60 dark:bg-card/30 p-2.5"
                    >
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{s.k}</div>
                      <div
                        className={`mt-0.5 font-mono text-sm font-semibold ${
                          s.tone === "pos"
                            ? "text-emerald-600 dark:text-emerald-300"
                            : "text-red-600 dark:text-red-300"
                        }`}
                      >
                        {s.v}
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* sparkline */}
                <div className="mt-3 rounded-lg border border-border/40 bg-card/60 dark:bg-card/30 p-2.5">
                  <svg viewBox="0 0 240 48" className="h-12 w-full" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="pp-eq" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(49,158,255)" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="rgb(49,158,255)" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <motion.path
                      d="M0,40 L24,36 L48,38 L72,30 L96,33 L120,24 L144,26 L168,16 L192,19 L216,10 L240,6"
                      fill="none"
                      stroke="rgb(49,158,255)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 1.1, ease: "easeInOut" }}
                    />
                    <path
                      d="M0,40 L24,36 L48,38 L72,30 L96,33 L120,24 L144,26 L168,16 L192,19 L216,10 L240,6 L240,48 L0,48 Z"
                      fill="url(#pp-eq)"
                    />
                  </svg>
                </div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 }}
                  className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Executed on SoDEX testnet · 5 fills · 41 bps slippage
                </motion.div>
              </Frame>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* phase indicator */}
      <div className="mt-2 grid grid-cols-4 gap-1.5 px-1 pb-1">
        {PHASES.map((p, i) => (
          <div key={p} className="flex flex-col gap-1">
            <div className="h-0.5 overflow-hidden rounded-full bg-border/60">
              <motion.div
                className="h-full bg-brand-500"
                initial={false}
                animate={{ width: i < phase ? "100%" : i === phase ? "100%" : "0%" }}
                transition={{ duration: i === phase && !reduce ? PHASE_MS / 1000 : 0.3, ease: "linear" }}
                key={`${p}-${phase}`}
              />
            </div>
            <span
              className={`truncate text-center text-[9px] sm:text-[10px] ${
                i === phase ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {p}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
