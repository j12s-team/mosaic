# Wave 2 submission — Mosaic

> Wave 1 closed with **~8.49 / 10 average** across 7 voters. Wave 2 is the
> point-by-point response to the substantive critiques. Full mapping in
> [`WAVE2.md`](./WAVE2.md).

> **Live demo:** https://mosaic-ivory.vercel.app · **Judge's guide:** https://mosaic-ivory.vercel.app/judges · **Live integration status:** https://mosaic-ivory.vercel.app/diag

## Wave 2 changelog (vs Wave 1)

- **Self-playing hero product preview** — an above-the-fold, dependency-free animation of the full thesis → basket → backtest → execute loop, so judges grasp the product in seconds.
- **Zero-setup demo mode** — one-click sample-thesis cards (AI Infra, DeFi Bluechip, DePIN, Memecoins, Mirror MAG7.ssi, RWA) that pre-fill and submit instantly, yielding a populated basket + analysis with no typing.
- **Clarity sweep** — plain-English "what this means" (?) hints on every headline metric (Sharpe, VaR/CVaR, max drawdown, slippage bps, concentration cap, …).
- **Judge's guide (`/judges`)** — 60-second test script, what to look for, an honest live-vs-simulated breakdown, and the exact SoSoValue + SoDEX endpoints called with sample responses.
- **Public diagnostics page (`/diag`)** — calls every integration live and reports status, so judges can verify the wiring in real time.
- **UX polish** — loading skeletons, error toasts with retry (no silent failures), staggered basket reveal, consistent live indicators.
- **Backtest engine** (`lib/backtest.ts`) — daily-rebalanced 90d replay; Sharpe, Sortino, max DD (+ date), beta vs MAG7.ssi, realised 30d vol, win-rate, vs-benchmark excess return.
- **Monte Carlo simulator** (`lib/montecarlo.ts`) — 1,000 bootstrap paths × 30d. Outputs p10/p50/p90 fan, VaR(95%), CVaR(95%), terminal-value histogram, loss probability.
- **Historical scenario stress tests** (`lib/scenarios.ts`) — basket replayed through COVID Mar 2020, FTX Nov 2022, ETH ETF Jul 2024 regimes.
- **SIWE wallet identity** (`lib/wallet.ts`, `components/dashboard/WalletButton.tsx`) — EIP-4361 sign-in over `window.ethereum`. Address shown in navbar, session in localStorage.
- **Per-wallet basket persistence + snapshot loop** (`lib/storage.ts`) — saved baskets keyed by address, t=0 snapshot recorded on execute, fresh snapshot recorded on every dashboard mount (rate-limited 6h apart) so the realised series fills in over time.
- **Predicted-vs-realised UI** (`components/dashboard/MyBaskets.tsx`) — each saved basket shows the thesis text, days held, realised return %, and a sparkline of the realised series.
- **Live network flag** (`MOSAIC_NETWORK=testnet|mainnet`) — SoDEX client switches base URL automatically. Navbar shows the active network badge.
- **Inline product tour** (`components/dashboard/ProductTour.tsx`) — dependency-free 5-step overlay on first visit; "Replay tour" button always available in the dashboard header.

## Wave 1 submission

> Below is the original Wave 1 record, kept for context.

---


## Project Overview

- **Project name:** Mosaic
- **Short description:** An agentic on-chain index manager. Describe a thesis in plain English; Mosaic uses SoSoValue's news, ETF flow, SSI and token metrics APIs to construct a risk-aware thematic basket, then executes through SoDEX's orderbook with explicit human confirmation on every irreversible move.
- **Target users:** Crypto-native retail traders who want structured, thesis-driven exposure but don't have the tooling, time, or quant skill to build and rebalance a portfolio themselves.
- **Core logic, APIs, and data sources:**
  - SoSoValue API: featured news, ETF spot flows, SSI list + composition, token metrics
  - SoDEX API: markets, orderbook depth, place order (IOC limit), account positions
  - Anthropic Claude (Haiku) for thesis classification (graceful keyword fallback)
- **Workflow:** Observe → Reason → Propose (with citations) → Confirm & Execute. Every loop pass that moves user funds is gated by a confirm step.

## Public GitHub Repository

- Repo: **https://github.com/j12s-team/mosaic**
- README with full setup, architecture, judging-criteria mapping, env vars: `README.md`
- Demo video script: `DEMO_SCRIPT.md`

## Demo

- Live demo URL: **https://mosaic-ivory.vercel.app**
- Judge's guide (start here): **https://mosaic-ivory.vercel.app/judges**
- Live integration status: **https://mosaic-ivory.vercel.app/diag**
- Local: `npm install && npm run dev → http://localhost:3000`

## Video Introduction

- Wave 2 script: see `DEMO_SCRIPT_WAVE2.md` (80–90 seconds)
- Original Wave 1 script: see `DEMO_SCRIPT.md`

## Team Information

- **Team:** Rivaldo (solo build — leaning into the "one-person business empire" framing the SoSoValue Buildathon highlights).
- **GitHub:** https://github.com/janneh2000
- **Contact:** cjanneh@gmail.com

## Wave 1 changelog

- Project scaffolded (Next.js 15 + Tailwind + custom dark-glass theme)
- Polished marketing/landing page mirroring the protocol/solguard aesthetic
- Server-rendered live-data section pulling SoSoValue news, ETF flows, SSI composition
- Typed SoSoValue and SoDEX clients with deterministic mock fallback
- Risk-aware portfolio-construction agent: theme decomposition, candidate scoring, softmax weighting, concentration caps
- Multi-leg execution-plan builder using SoDEX orderbook depth and IOC slippage-bps preview
- Interactive `/app` dashboard: thesis input, agent log, basket proposal with per-token rationale, execution preview with confirm gate, portfolio with rebalance proposals carrying citations
- Wave 2 / Wave 3 roadmap committed in README
