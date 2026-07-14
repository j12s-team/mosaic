import Link from "next/link";
import { Button } from "@mosaic/ui/button";
import { Badge } from "@mosaic/ui/badge";
import { ArrowRight, Sparkles } from "lucide-react";
import { ProductPreview } from "@/components/landing/ProductPreview";

export function Hero() {
  return (
    <section className="relative overflow-hidden">

      <div className="relative mx-auto flex max-w-content flex-col items-center px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-28 sm:pb-20">
        <Badge variant="brand" className="mb-6">
          <Sparkles className="h-3 w-3" />
          <span className="font-mono text-[11px]">SoSoValue · SoDEX · SSI · Agentic AI</span>
        </Badge>

        <h1 className="max-w-4xl text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-7xl">
          Your personal crypto{" "}
          <span className="text-primary">hedge fund</span>,
          <br className="hidden sm:block" />
          run by an agent.
        </h1>

        <p className="mt-6 max-w-2xl text-balance text-lg text-on-surface-variant md:text-xl">
          Describe a thesis in plain English. Mosaic reads SoSoValue&apos;s news, ETF flows and SSI
          indices to assemble a thematic on-chain basket, routes it through SoDEX&apos;s orderbook,
          then keeps watching the data and proposes rebalances — with you in the confirm loop.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link href={process.env.NEXT_PUBLIC_APP_URL ?? "/app"}>
            <Button size="lg" className="group">
              Launch the agent
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </Link>
          <Link href="/#how">
            <Button size="lg" variant="secondary">
              See how it works
            </Button>
          </Link>
        </div>

        <div className="mt-6 flex items-center gap-2 text-xs text-on-surface-variant">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          Live on SoDEX testnet · mainnet read-only · no seed required
        </div>

        {/* Self-playing product preview — shows the whole loop without a click. */}
        <div className="mt-12 w-full max-w-2xl">
          <ProductPreview />
        </div>

        <div className="mt-14 grid w-full max-w-4xl grid-cols-2 gap-3 text-left sm:grid-cols-4">
          {[
            { k: "Data", v: "SoSoValue news · flows · SSI · metrics" },
            { k: "Execution", v: "SoDEX spot orderbook" },
            { k: "Agent loop", v: "Detect → Propose → Confirm" },
            { k: "Status", v: "Live · continuously shipping" },
          ].map((s) => (
            <div
              key={s.k}
              className="rounded-md border border-outline-variant bg-surface-container-low dark:bg-surface-container-low px-4 py-3"
            >
              <div className="text-[10px] uppercase tracking-wider text-on-surface-variant">
                {s.k}
              </div>
              <div className="mt-1 text-sm font-medium leading-snug">{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
