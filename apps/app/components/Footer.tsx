/** Platform footer — brand mono, mirrors the site (Amendment 2). */
export function Footer() {
  const network =
    (process.env.NEXT_PUBLIC_MOSAIC_NETWORK as "testnet" | "mainnet" | undefined) ?? "testnet";
  return (
    <footer className="mt-16 border-t border-[var(--line)]">
      <div className="mx-auto flex max-w-content flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mosaic-mark-flat.svg" alt="" className="h-5 w-5" />
          <span className="brand-eyebrow">© 2026 Mosaic — all rights reserved</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="brand-eyebrow">sodex {network}</span>
          <a
            href="https://github.com/j12s-team/mosaic"
            target="_blank"
            rel="noopener noreferrer"
            className="brand-eyebrow hover:text-[var(--btext)]"
          >
            github
          </a>
        </div>
      </div>
    </footer>
  );
}
