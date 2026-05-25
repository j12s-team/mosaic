import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CTA() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-5xl px-6 py-24">
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-brand-950/80 via-card/40 to-card/40 p-12 text-center backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-0 opacity-50 [background:radial-gradient(800px_circle_at_50%_-20%,rgba(49,158,255,0.35),transparent)]" />
          <h2 className="relative text-balance text-4xl font-semibold leading-tight md:text-5xl">
            Stop chasing alpha.
            <br className="hidden sm:block" />
            <span className="text-gradient-brand">Architect it.</span>
          </h2>
          <p className="relative mx-auto mt-5 max-w-xl text-muted-foreground">
            Tell Mosaic your thesis. Watch the agent build, execute, and maintain it on-chain — no
            spreadsheet, no Discord-tab-roulette, no quant desk required.
          </p>
          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/app">
              <Button size="lg" className="group">
                Launch the agent
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
            <a
              href="https://github.com/j12s-team/mosaic"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="lg" variant="secondary">
                View on GitHub
              </Button>
            </a>
          </div>
          <p className="relative mt-6 text-xs text-muted-foreground">
            Open source · MIT licensed · shipped continuously, not at hackathon deadlines
          </p>
        </div>
      </div>
    </section>
  );
}
