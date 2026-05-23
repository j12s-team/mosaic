import { Quote, Boxes, Workflow, ShieldCheck } from "lucide-react";

const STEPS = [
  {
    num: "01",
    icon: Quote,
    title: "You write the thesis",
    body: "“I want AI-infrastructure exposure with $1,000 and moderate risk.” That’s the whole input. No tickers, no weights, no charts.",
    bullet: "Plain English in. Index out.",
  },
  {
    num: "02",
    icon: Boxes,
    title: "The agent constructs the basket",
    body: "Mosaic decomposes the thesis into themes, scores candidates with SoSoValue’s metrics, news sentiment and ETF flows, and applies risk-adjusted weights with concentration caps.",
    bullet: "Backed by SoSoValue indices + research data.",
  },
  {
    num: "03",
    icon: Workflow,
    title: "SoDEX executes the basket",
    body: "Multi-leg routing through SoDEX’s orderbook. Mosaic walks the depth to estimate slippage, splits orders, and uses IOC limits — no market orders, no leakage.",
    bullet: "On-chain orderbook. CEX-like fills.",
  },
  {
    num: "04",
    icon: ShieldCheck,
    title: "You confirm every move",
    body: "When news, flows or drift trigger a rebalance, the agent proposes the change with citations and reasoning. You confirm in one click.",
    bullet: "Agentic, but you keep the keys.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative mx-auto max-w-7xl px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-brand-600 dark:text-brand-300">
          How Mosaic works
        </p>
        <h2 className="mt-3 text-balance text-4xl font-semibold leading-tight md:text-5xl">
          From thesis to portfolio in four steps.
        </h2>
      </div>

      <ol className="relative mt-16 grid gap-6 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li
            key={s.num}
            className="group relative flex flex-col rounded-2xl border border-border/40 bg-card/80 dark:bg-card/40 p-6 backdrop-blur-xl"
          >
            <div className="mb-6 flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">{s.num}</span>
              <s.icon className="h-5 w-5 text-brand-600 dark:text-brand-300" />
            </div>
            <h3 className="text-lg font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            <div className="mt-auto pt-5">
              <p className="text-xs font-medium uppercase tracking-wider text-brand-600/80 dark:text-brand-300/80">
                {s.bullet}
              </p>
            </div>
            {i < STEPS.length - 1 && (
              <div className="absolute -right-3 top-1/2 hidden h-px w-6 bg-gradient-to-r from-white/20 to-transparent lg:block" />
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
