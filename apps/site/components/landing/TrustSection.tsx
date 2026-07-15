const PANELS = [
  {
    title: "You confirm every move",
    body: "Every action that touches funds sits behind an explicit review step with per-leg slippage preview. The agent proposes; you dispose.",
    tag: "shipped",
  },
  {
    title: "Signed mandates bound the agent",
    body: "One human-readable EIP-712 mandate per basket — notional cap, allowed tokens, slippage and drift limits, cooldowns, expiry. Enforced server-side on every plan, with an audit trail. On-chain enforcement is on the roadmap.",
    tag: "shipped · on-chain roadmap",
  },
  {
    title: "Tamper-evident track records",
    body: "Every portfolio snapshot is hash-chained and signed — rewriting any historical value breaks every later link, and anyone can verify a public basket's chain.",
    tag: "shipped",
  },
  {
    title: "Safety rails by default",
    body: "Testnet by default. Mainnet requires deliberate flags, starts in dry-run, and sits behind a global notional cap and an emergency kill switch.",
    tag: "shipped",
  },
];

/** Trust — only claims that are true today; roadmap labeled as roadmap. */
export function TrustSection() {
  return (
    <section className="mx-auto max-w-content px-4 py-24 sm:px-6">
      <p className="brand-eyebrow">why trust it</p>
      <h2 className="brand-wordmark mt-4 text-2xl sm:text-4xl">
        BOUNDED <span className="brand-gradient-text">AUTONOMY</span>
      </h2>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {PANELS.map((p) => (
          <div key={p.title} className="brand-panel p-7">
            <div className="flex items-start justify-between gap-3">
              <h3
                className="text-lg font-semibold text-[var(--btext)]"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {p.title}
              </h3>
              <span className="brand-chip shrink-0">{p.tag}</span>
            </div>
            <p
              className="mt-3 text-sm leading-relaxed text-[var(--bdim)]"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {p.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
