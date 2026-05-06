import { Card } from "@/components/ui/card";

const ROWS = [
  {
    criterion: "User Value & Practical Impact",
    weight: "30%",
    delivery: "Solves a real, painful workflow: building, executing, and maintaining a thematic crypto portfolio without a Bloomberg terminal or a quant desk.",
  },
  {
    criterion: "Functionality & Working Demo",
    weight: "25%",
    delivery: "End-to-end flow live: thesis → basket → SoDEX execution preview → portfolio + rebalance proposals — all interactive.",
  },
  {
    criterion: "Logic, Workflow & Product Design",
    weight: "20%",
    delivery: "Clear four-stage agentic loop. Risk-aware scoring kernel, concentration caps, IOC orders. Every irreversible action gated.",
  },
  {
    criterion: "Data / API Integration",
    weight: "15%",
    delivery: "Five SoSoValue surfaces (news, ETF flow, SSI list, SSI composition, token metrics) plus four SoDEX endpoints (markets, depth, place order, positions).",
  },
  {
    criterion: "UX & Clarity",
    weight: "10%",
    delivery: "Plain-English thesis input. Visual basket. Reasoning citations. Single-screen rebalance review. Dark, fast, mobile-friendly.",
  },
];

export function WhyMosaic() {
  return (
    <section id="why" className="relative mx-auto max-w-7xl px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-brand-300">
          Built for the rubric
        </p>
        <h2 className="mt-3 text-balance text-4xl font-semibold leading-tight md:text-5xl">
          Mapped to every judging criterion.
        </h2>
        <p className="mt-4 text-balance text-muted-foreground">
          Wave 1 is about direction, integration depth, and a working flow. Mosaic ships all three.
        </p>
      </div>

      <Card className="mt-14 overflow-hidden">
        <div className="divide-y divide-white/5">
          {ROWS.map((r) => (
            <div
              key={r.criterion}
              className="grid grid-cols-1 gap-4 p-6 md:grid-cols-[2fr_1fr_4fr]"
            >
              <div className="font-medium">{r.criterion}</div>
              <div className="font-mono text-sm text-brand-300">{r.weight}</div>
              <div className="text-sm text-muted-foreground">{r.delivery}</div>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}
