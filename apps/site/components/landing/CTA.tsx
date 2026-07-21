import Link from "next/link";
import { ArrowRight } from "lucide-react";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "/app";

export function CTA() {
  return (
    <section className="mx-auto max-w-content px-4 pb-28 pt-4 sm:px-6">
      <div className="brand-panel relative overflow-hidden p-10 text-center sm:p-16">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: "var(--spectrum)" }}
        />
        <p className="brand-eyebrow">zero setup · mainnet by default</p>
        <h2 className="brand-wordmark mt-5 text-2xl leading-snug sm:text-4xl">
          DON&apos;T CHASE THE NARRATIVE.
          <br />
          <span className="brand-gradient-text">ARCHITECT IT.</span>
        </h2>
        <p
          className="mx-auto mt-5 max-w-xl text-base text-[var(--bdim)]"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Tell Mosaic your thesis. Watch the agent build, analyse and execute it — no
          spreadsheet, no tab-roulette, no quant desk required.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link href={APP_URL} className="btn-spectrum">
            Launch the agent <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
