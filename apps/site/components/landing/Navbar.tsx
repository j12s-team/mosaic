import Link from "next/link";
import { Button } from "@mosaic/ui/button";
import { ThemeToggle } from "@mosaic/ui/ThemeToggle";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "/app";

export function Navbar() {
  const network =
    (process.env.NEXT_PUBLIC_MOSAIC_NETWORK as "testnet" | "mainnet" | undefined) ?? "testnet";
  const isMain = network === "mainnet";
  return (
    <header className="sticky top-0 z-50 border-b border-outline-variant bg-surface-container">
      <nav className="mx-auto flex h-16 max-w-content items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-void p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mosaic-mark-flat.svg" alt="Mosaic" className="h-6 w-6" />
          </span>
          <span className="font-brand text-sm tracking-[0.06em]">MOSAIC</span>
          <span
            className={`ml-2 hidden rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider sm:inline ${
              isMain
                ? "border-transparent bg-success-container text-on-success-container "
                : "border-transparent bg-warning-container text-on-warning-container "
            }`}
          >
            SoDEX {network}
          </span>
        </Link>
        <div className="hidden items-center gap-7 text-sm text-on-surface-variant md:flex">
          <Link href="/#how" className="hover:text-on-surface">How it works</Link>
          <Link href="/#data" className="hover:text-on-surface">Data sources</Link>
          <Link href="/#loop" className="hover:text-on-surface">Agentic loop</Link>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link
            href="https://github.com/j12s-team/mosaic"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden text-sm text-on-surface-variant hover:text-on-surface lg:inline-block"
          >
            GitHub
          </Link>
          <ThemeToggle />
          <Link href={APP_URL}>
            <Button size="sm" className="hidden sm:inline-flex">Launch App</Button>
            <Button size="icon" variant="default" className="sm:hidden" aria-label="Launch App">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/mosaic-mark-flat.svg" alt="" className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </nav>
    </header>
  );
}
