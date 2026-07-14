import Link from "next/link";
import { Github, Hexagon } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-outline-variant">
      <div className="mx-auto flex max-w-content flex-col items-start gap-6 px-6 py-12 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/20 ring-1 ring-primary/40">
            <Hexagon className="h-4 w-4 text-primary" />
          </span>
          <div>
            <div className="font-semibold">Mosaic</div>
            <div className="text-xs text-on-surface-variant">
              Agentic on-chain index manager · powered by SoSoValue + SoDEX
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm md:grid-cols-3">
          <a href="https://sosovalue.com" target="_blank" rel="noopener noreferrer" className="text-on-surface-variant hover:text-on-surface">
            SoSoValue
          </a>
          <a href="https://sodex.com" target="_blank" rel="noopener noreferrer" className="text-on-surface-variant hover:text-on-surface">
            SoDEX
          </a>
          <a href="https://ssi.sosovalue.com" target="_blank" rel="noopener noreferrer" className="text-on-surface-variant hover:text-on-surface">
            SSI Protocol
          </a>
          <a href="https://discord.gg/HQuGhhkhUW" target="_blank" rel="noopener noreferrer" className="text-on-surface-variant hover:text-on-surface">
            Discord
          </a>
          <a href="https://app.akindo.io/wave-hacks" target="_blank" rel="noopener noreferrer" className="text-on-surface-variant hover:text-on-surface">
            Akindo
          </a>
          <Link href="/#how" className="text-on-surface-variant hover:text-on-surface">
            How it works
          </Link>
        </div>
      </div>
      <div className="border-t border-outline-variant">
        <div className="mx-auto flex max-w-content flex-col items-start justify-between gap-2 px-6 py-5 text-xs text-on-surface-variant md:flex-row md:items-center">
          <div>
            Built by{" "}
            <a
              href="https://github.com/janneh2000"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-on-surface underline-offset-4 hover:text-primary hover:underline"
            >
              <Github className="h-3.5 w-3.5" />
              Rivaldo
            </a>{" "}
            · open source, continuously shipping · MIT licensed
          </div>
          <div className="font-mono text-[11px]">
            © {new Date().getFullYear()} Mosaic
          </div>
        </div>
      </div>
    </footer>
  );
}
