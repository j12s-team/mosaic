import { TrendingDown, ScrollText, Scale, Zap } from "lucide-react";

const PAINS = [
  {
    icon: TrendingDown,
    title: "Retail buys tops, sells bottoms",
    body: "Without a structured thesis, individual traders chase narratives instead of pricing them.",
  },
  {
    icon: ScrollText,
    title: "Information overload",
    body: "ETF flows, news, on-chain signals, sentiment — all of it, every minute, across hundreds of assets.",
  },
  {
    icon: Scale,
    title: "No risk discipline",
    body: "One position blows up the book. Rebalancing requires time and tooling that most users don’t have.",
  },
  {
    icon: Zap,
    title: "Execution friction",
    body: "AMMs leak edge. Even when retail has a view, getting a basket on-chain is slow and expensive.",
  },
];

export function Problem() {
  return (
    <section className="relative mx-auto max-w-7xl px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-brand-300">The problem</p>
        <h2 className="mt-3 text-balance text-4xl font-semibold leading-tight md:text-5xl">
          Retail can&apos;t run a portfolio. Mosaic does it for them.
        </h2>
        <p className="mt-4 text-balance text-muted-foreground">
          The tools to build, execute, and rebalance a thematic crypto portfolio already exist —
          they&apos;re just locked behind hedge fund desks. Mosaic packages them into one agent.
        </p>
      </div>

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PAINS.map((p) => (
          <div
            key={p.title}
            className="group relative overflow-hidden rounded-2xl border border-white/5 bg-card/40 p-6 backdrop-blur-xl transition hover:border-white/10"
          >
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand-500/5 blur-3xl transition group-hover:bg-brand-500/15" />
            <p.icon className="h-5 w-5 text-brand-300" />
            <h3 className="mt-4 font-medium">{p.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
