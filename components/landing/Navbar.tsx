import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Hexagon } from "lucide-react";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-background/40 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500/20 ring-1 ring-brand-500/40">
            <Hexagon className="h-4 w-4 text-brand-300" />
          </span>
          <span className="text-base">Mosaic</span>
          <span className="ml-2 hidden rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">
            SoSoValue Buildathon
          </span>
        </Link>
        <div className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <Link href="/#how" className="hover:text-foreground">How it works</Link>
          <Link href="/#data" className="hover:text-foreground">Data sources</Link>
          <Link href="/#loop" className="hover:text-foreground">Agentic loop</Link>
          <Link href="/#why" className="hover:text-foreground">Why Mosaic</Link>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="https://github.com/janneh2000/mosaic"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline-block"
          >
            GitHub
          </Link>
          <Link href="/app">
            <Button size="sm">Launch App</Button>
          </Link>
        </div>
      </nav>
    </header>
  );
}
