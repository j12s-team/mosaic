import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Hexagon } from "lucide-react";
import { WalletButton } from "@/components/dashboard/WalletButton";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Navbar() {
  const network =
    (process.env.NEXT_PUBLIC_MOSAIC_NETWORK as "testnet" | "mainnet" | undefined) ?? "testnet";
  const isMain = network === "mainnet";
  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-secondary/30 dark:bg-background/40 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500/20 ring-1 ring-brand-500/40">
            <Hexagon className="h-4 w-4 text-brand-500 dark:text-brand-300" />
          </span>
          <span className="text-base">Mosaic</span>
          <span
            className={`ml-2 hidden rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider sm:inline ${
              isMain
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300"
            }`}
          >
            SoDEX {network}
          </span>
        </Link>
        <div className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <Link href="/#how" className="hover:text-foreground">How it works</Link>
          <Link href="/#data" className="hover:text-foreground">Data sources</Link>
          <Link href="/#loop" className="hover:text-foreground">Agentic loop</Link>
          <Link href="/#why" className="hover:text-foreground">Why Mosaic</Link>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link
            href="https://github.com/janneh2000/mosaic"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden text-sm text-muted-foreground hover:text-foreground lg:inline-block"
          >
            GitHub
          </Link>
          <ThemeToggle />
          <Link href="/app">
            <Button size="sm" className="hidden sm:inline-flex">Launch App</Button>
            <Button size="icon" variant="default" className="sm:hidden" aria-label="Launch App">
              <Hexagon className="h-4 w-4" />
            </Button>
          </Link>
          <WalletButton />
        </div>
      </nav>
    </header>
  );
}
