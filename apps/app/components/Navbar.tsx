import Link from "next/link";
import { WalletButton } from "@/components/dashboard/WalletButton";

/** Platform navbar — brand shell (OpenSpec: brand-shell-app); WalletButton
 *  remains an MD3 control. */
export function Navbar() {
  const network =
    (process.env.NEXT_PUBLIC_MOSAIC_NETWORK as "testnet" | "mainnet" | undefined) ?? "testnet";
  const isMain = network === "mainnet";
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[rgba(8,6,17,0.85)] backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-content items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-[var(--panel2)] p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mosaic-mark-flat.svg" alt="Mosaic" className="h-6 w-6" />
          </span>
          <span className="brand-wordmark text-sm">MOSAIC</span>
          <span
            className="brand-eyebrow hidden sm:inline"
            style={{ color: isMain ? "var(--sunset)" : "var(--cyan)" }}
          >
            ://sodex_{network}
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <WalletButton />
        </div>
      </nav>
    </header>
  );
}
