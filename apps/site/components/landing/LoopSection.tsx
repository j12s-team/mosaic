const STEPS = [
  {
    n: "01",
    name: "Observe",
    color: "var(--cyan)",
    body: "The agent reads SoSoValue continuously — featured news, ETF spot flows, SSI index composition, token momentum, sentiment and liquidity.",
  },
  {
    n: "02",
    name: "Reason",
    color: "var(--bblue)",
    body: "Your thesis decomposes into themes. Candidates are scored on momentum, sentiment, volatility and liquidity, then weighted with concentration caps for your risk profile.",
  },
  {
    n: "03",
    name: "Propose",
    color: "var(--bpurple)",
    body: "Every basket and rebalance arrives as a proposal with citations — the headline, the flow datapoint or the drift that triggered it. Backtest, Monte Carlo and stress tests run alongside.",
  },
  {
    n: "04",
    name: "Confirm & execute",
    color: "var(--mag)",
    body: "Nothing irreversible happens without you. On confirmation, IOC limit orders route through SoDEX's orderbook with slippage previewed per leg — bounded by your signed mandate.",
  },
];

/** The four-stage agentic loop — why retail can't do this alone, and how Mosaic does. */
export function LoopSection() {
  return (
    <section id="loop" className="relative mx-auto max-w-content px-4 py-24 sm:px-6">
      <p className="brand-eyebrow">the agentic loop</p>
      <h2 className="brand-wordmark mt-4 text-2xl sm:text-4xl">
        NOT SIGNALS. <span className="brand-gradient-text">BASKETS.</span>
      </h2>
      <p
        className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--bdim)]"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        Chasing narratives one trade at a time is how retail loses. Mosaic treats your idea the
        way an index desk would: price the thesis, structure the basket, execute as one plan,
        keep watching the data.
      </p>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <div key={s.n} className="brand-panel p-6">
            <div
              className="brand-eyebrow"
              style={{ color: s.color }}
            >
              {s.n}
            </div>
            <div
              className="mt-3 text-lg font-semibold text-[var(--btext)]"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {s.name}
            </div>
            <p
              className="mt-3 text-sm leading-relaxed text-[var(--bdim)]"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {s.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
