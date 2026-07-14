import Link from "next/link";
import { Hexagon } from "lucide-react";
import { WalletButton } from "@/components/dashboard/WalletButton";
import { ThemeToggle } from "@mosaic/ui/ThemeToggle";

/** Platform navbar — product chrome only (no marketing links). */
export function Navbar() {
  const network =
    (process.env.NEXT_PUBLIC_MOSAIC_NETWORK as "testnet" | "mainnet" | undefined) ?? "testnet";
  const isMain = network === "mainnet";
  return (
    <header className="sticky top-0 z-50 border-b border-outline-variant bg-surface-container">
      <nav className="mx-auto flex h-16 max-w-content items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary-container">
            <Hexagon className="h-4 w-4 text-primary" />
          </span>
          <span className="text-base">Mosaic</span>
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
        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <WalletButton />
        </div>
      </nav>
    </header>
  );
}
