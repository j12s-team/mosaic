"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, X, Sparkles } from "lucide-react";

interface Step {
  selector: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    selector: "[data-tour='thesis']",
    title: "1 · Describe your thesis",
    body: "Tell Mosaic the exposure you want — in plain English. Pick an amount and a risk profile.",
  },
  {
    selector: "[data-tour='agent']",
    title: "2 · Watch the agent reason",
    body: "Mosaic decomposes your thesis, scores the universe against SoSoValue metrics, and walks the SoDEX orderbook for each leg.",
  },
  {
    selector: "[data-tour='basket']",
    title: "3 · Review the basket",
    body: "Weights, per-token rationale, sentiment, liquidity, and a benchmark. The whole portfolio, with its reasoning.",
  },
  {
    selector: "[data-tour='analysis']",
    title: "4 · Verify the math",
    body: "90-day backtest, Sharpe / Sortino / max DD, Monte Carlo with VaR & CVaR, and three historical regime stress tests.",
  },
  {
    selector: "[data-tour='execute']",
    title: "5 · Confirm & execute on SoDEX",
    body: "IOC limit orders with 50bps slippage cap. You confirm every irreversible move — and every rebalance later.",
  },
];

const SEEN_KEY = "mosaic.tour.seen";

function scrollToSelector(sel: string) {
  if (typeof document === "undefined") return null;
  const el = document.querySelector(sel) as HTMLElement | null;
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  return el;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getRect(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function ProductTour({ forceOpen = false, onClose }: { forceOpen?: boolean; onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      setIdx(0);
      return;
    }
    if (typeof localStorage === "undefined") return;
    if (!localStorage.getItem(SEEN_KEY)) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [forceOpen]);

  useEffect(() => {
    if (!open) return;
    const step = STEPS[idx];
    const el = scrollToSelector(step.selector);
    if (el) {
      setRect(getRect(el));
      const onScroll = () => setRect(getRect(el));
      const onResize = () => setRect(getRect(el));
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", onResize);
      const interval = window.setInterval(onScroll, 250); // catch layout shifts
      return () => {
        window.removeEventListener("scroll", onScroll, true);
        window.removeEventListener("resize", onResize);
        window.clearInterval(interval);
      };
    } else {
      setRect(null);
    }
  }, [idx, open]);

  function close() {
    setOpen(false);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(SEEN_KEY, "1");
    }
    onClose?.();
  }

  if (!open) return null;
  const step = STEPS[idx];

  const padding = 8;
  const highlight = rect
    ? {
        top: Math.max(8, rect.top - padding),
        left: Math.max(8, rect.left - padding),
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      }
    : null;

  // Pick the card width: full on small viewports, fixed 360px on desktop.
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const cardWidth = isMobile ? Math.min(window.innerWidth - 24, 360) : 360;

  // Position card below the highlight where possible, otherwise centered.
  const card = highlight
    ? {
        top: Math.min(
          (typeof window !== "undefined" ? window.innerHeight : 800) - 240,
          Math.max(8, highlight.top + highlight.height + 12),
        ),
        left: Math.min(
          (typeof window !== "undefined" ? window.innerWidth : 1200) - cardWidth - 8,
          Math.max(8, highlight.left),
        ),
      }
    : {
        top:
          (typeof window !== "undefined" ? window.innerHeight : 800) / 2 - 110,
        left:
          (typeof window !== "undefined" ? window.innerWidth : 1200) / 2 -
          cardWidth / 2,
      };

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Dimmed overlay with cutout */}
      <div className="pointer-events-auto absolute inset-0 bg-black/40" onClick={close} />
      {highlight && (
        <div
          className="absolute rounded-md ring-2 ring-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] transition-all duration-200"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
          }}
        />
      )}

      {/* Step card */}
      <div
        className="pointer-events-auto absolute rounded-lg border border-outline-variant bg-surface-container-low p-5 shadow-elevation-3 transition-all duration-200"
        style={{ top: card.top, left: card.left, width: cardWidth }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-[10px] uppercase tracking-wider text-primary">
              Mosaic tour · {idx + 1} / {STEPS.length}
            </span>
          </div>
          <button
            onClick={close}
            className="rounded-sm p-1 text-on-surface-variant hover:text-on-surface"
            aria-label="Close tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h3 className="mt-2 text-base font-semibold">{step.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{step.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <Button size="sm" variant="ghost" onClick={close}>
            Skip
          </Button>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={idx === 0}
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
            {idx < STEPS.length - 1 ? (
              <Button size="sm" onClick={() => setIdx((i) => i + 1)}>
                Next <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button size="sm" onClick={close}>
                Got it
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
