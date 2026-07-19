export function Footer() {
  return (
    <footer className="border-t border-[var(--line)]">
      <div className="mx-auto flex max-w-content flex-col items-center justify-between gap-4 px-4 py-10 sm:flex-row sm:px-6">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mosaic-mark-flat.svg" alt="" className="h-5 w-5" />
          <span className="brand-eyebrow">© 2026 Mosaic — all rights reserved</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="brand-eyebrow">sodex testnet</span>
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
