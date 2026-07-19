import Link from "next/link";
import { ArrowRight } from "lucide-react";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "/app";

/** Brand hero — promise, wordmark, dual CTA, trust chips. */
export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="brand-grid-floor" aria-hidden />
      <div className="brand-scanlines" aria-hidden />

      <div className="relative mx-auto flex max-w-content flex-col items-center px-4 pb-20 pt-24 text-center sm:px-6 sm:pt-28">
        <p className="brand-eyebrow brand-caret mb-8">
          reads · assembles · routes · rebalances — you confirm{" "}
        </p>

        <h1 className="brand-wordmark text-5xl sm:text-7xl md:text-8xl">MOSAIC</h1>

        <p
          className="mt-8 max-w-2xl text-balance text-xl font-medium leading-snug text-[var(--btext)] sm:text-2xl"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Your personal crypto hedge fund, run by an agent.
        </p>
        <p
          className="mt-4 max-w-xl text-base leading-relaxed text-[var(--bdim)]"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Describe a thesis in plain English. Mosaic prices it against live news, ETF flows and
          index data, assembles a risk-capped basket, and routes it through an orderbook —
          proposing rebalances as the data shifts.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link href={APP_URL} className="btn-spectrum">
            Launch the agent <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/#loop" className="btn-ghost">
            See how it works
          </Link>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-2">
          <span className="brand-chip">you confirm every move</span>
          <span className="brand-chip">EIP-712 signed mandates</span>
          <span className="brand-chip">tamper-evident track records</span>
          <span className="brand-chip">SoSoValue Buildathon W1 · 8.49/10</span>
        </div>
      </div>
    </section>
  );
}
