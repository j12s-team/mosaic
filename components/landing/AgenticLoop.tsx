import { Eye, Brain, MessagesSquare, CheckCircle2 } from "lucide-react";

const NODES = [
  {
    icon: Eye,
    title: "Observe",
    body: "SoSoValue news, flow, SSI composition, on-chain metrics polled continuously.",
    detail: "Polled every 30s server-side",
  },
  {
    icon: Brain,
    title: "Reason",
    body: "Agent scores drift, sentiment shifts and flow reversals against your basket targets.",
    detail: "Risk-aware scoring kernel",
  },
  {
    icon: MessagesSquare,
    title: "Propose",
    body: "Generates a rebalance with citations: which news, which flow, which metric — and the diff.",
    detail: "Natural-language reasoning",
  },
  {
    icon: CheckCircle2,
    title: "Confirm & execute",
    body: "You approve. Mosaic routes IOC limit orders through SoDEX with slippage caps.",
    detail: "Human-in-the-loop, on-chain",
  },
];

export function AgenticLoop() {
  return (
    <section id="loop" className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-brand-500/[0.04] to-transparent" />
      <div className="mx-auto max-w-7xl px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-brand-300">
            The agentic loop
          </p>
          <h2 className="mt-3 text-balance text-4xl font-semibold leading-tight md:text-5xl">
            A loop that runs while you sleep — and stops at every irreversible move.
          </h2>
        </div>

        <div className="mt-16">
          <div className="relative grid gap-4 md:grid-cols-4">
            <svg
              aria-hidden
              className="absolute inset-x-0 top-12 hidden h-px md:block"
              viewBox="0 0 1200 1"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgba(49,158,255,0)" />
                  <stop offset="50%" stopColor="rgba(49,158,255,0.6)" />
                  <stop offset="100%" stopColor="rgba(49,158,255,0)" />
                </linearGradient>
              </defs>
              <line x1="0" y1="0.5" x2="1200" y2="0.5" stroke="url(#line)" strokeWidth="1" />
            </svg>

            {NODES.map((n) => (
              <div key={n.title} className="relative flex flex-col items-center text-center">
                <div className="ring-glow grid h-24 w-24 place-items-center rounded-2xl border border-white/10 bg-card/60 backdrop-blur-xl">
                  <n.icon className="h-7 w-7 text-brand-300" />
                </div>
                <h3 className="mt-5 text-base font-semibold">{n.title}</h3>
                <p className="mt-2 max-w-xs text-sm text-muted-foreground">{n.body}</p>
                <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-brand-300/80">
                  {n.detail}
                </p>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-white/5 bg-card/40 p-6 backdrop-blur-xl">
            <p className="text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Risk control by construction.</span>{" "}
              No market orders. No silent rebalances. No off-chain custody. The agent observes and
              proposes; you sign and ship. Every proposal carries citations — the news item, the
              flow datapoint, or the metric drift that triggered it — so a judge or a user can
              always verify the reasoning.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
