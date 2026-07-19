import Link from "next/link";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "/app";

/** Brand Layer 1 topbar (identity-page composition). */
export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[rgba(8,6,17,0.85)] backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-content items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-[var(--panel2)] p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mosaic-mark-flat.svg" alt="Mosaic" className="h-6 w-6" />
          </span>
          <span className="brand-wordmark text-sm">MOSAIC</span>
          <span className="brand-eyebrow hidden text-[var(--cyan)] md:inline">
            ://agent_hedge_fund
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/j12s-team/mosaic"
            target="_blank"
            rel="noopener noreferrer"
            className="brand-eyebrow hidden hover:text-[var(--btext)] lg:inline-block"
          >
            GitHub
          </a>
          <Link href={APP_URL} className="btn-spectrum !h-9 !px-5 !text-sm">
            Launch App
          </Link>
        </div>
      </nav>
    </header>
  );
}
