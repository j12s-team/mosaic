# Mosaic — your personal crypto hedge fund, run by an agent

> **SoSoValue Buildathon** · Wave 1 ✓ (avg ~8.49 / 10) · **Wave 2 — Build Phase May 23 – Jun 7, 2026**
>
> **Live:** https://mosaic-ivory.vercel.app · **Start here (judges):** [/judges](https://mosaic-ivory.vercel.app/judges) · **Live status:** [/diag](https://mosaic-ivory.vercel.app/diag)
>
> An agentic on-chain index manager: describe a thesis in plain English, Mosaic constructs
> a thematic portfolio from SoSoValue data, executes it through the SoDEX orderbook, and
> proposes rebalances when the underlying signals shift — with the user in the confirm loop.
>
> **Wave 2 ships:** a self-playing hero product preview, zero-setup one-click demo theses,
> plain-English help on every metric, a `/judges` guide and live `/diag` status page, plus
> the analytical core — 90-day backtest engine, 1,000-path Monte Carlo (VaR / CVaR), three
> historical regime stress tests, WalletConnect-style SIWE identity, per-wallet basket
> persistence with realised-return tracking, and live SoDEX testnet wiring. See
> [`WAVE2.md`](./WAVE2.md) for the line-by-line response to each Wave 1 judge critique.

---

## TL;DR

| | |
|---|---|
| **What it does** | Turns a one-sentence investment thesis into a live, on-chain, risk-aware index that the agent maintains for you. |
| **Why now** | SoSoValue exposes the data needed to *price* a thesis (news, ETF flows, SSI composition, momentum). SoDEX's orderbook lets you *execute* one without AMM leakage. Together they make a one-person hedge fund possible. |
| **Who it's for** | Crypto-native retail traders who want structured exposure but don't have the time, tooling, or quant skill to run a portfolio themselves. |
| **What's unique** | Not another signal bot. Mosaic produces *baskets*, not picks — anchored to SoSoValue's SSI design philosophy, with concentration caps, IOC-only execution, and human confirmation on every irreversible move. |

---

## Live demo

| | |
|---|---|
| Marketing site | `/` |
| Interactive prototype | `/app` |
| API: build basket from thesis | `POST /api/thesis` |
| API: route execution plan | `POST /api/execute` |
| API: portfolio + pending rebalances | `GET /api/portfolio` |

The prototype runs end-to-end with deterministic mocks so the demo never falls over.
Plug in keys to flip into live SoSoValue + SoDEX-testnet mode.

---

## The four-stage agentic loop

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌─────────────┐
│ Observe  │──▶│  Reason  │──▶│ Propose  │──▶│ Confirm &   │
│ SoSoVal. │   │  scoring │   │ +citations│   │ execute via │
│ news/    │   │  kernel  │   │           │   │ SoDEX       │
│ flows/   │   │          │   │           │   │ (IOC limit) │
│ SSI/     │   │          │   │           │   │             │
│ metrics  │   │          │   │           │   │             │
└──────────┘   └──────────┘   └──────────┘   └─────────────┘
       ▲                                            │
       └────────────────────────────────────────────┘
                  (drift triggers next pass)
```

Every loop pass that touches user funds is gated by an explicit confirm.

---

## Architecture

```
mosaic/
├── app/
│   ├── page.tsx                  Landing page (server-rendered with live SoSoValue data)
│   ├── app/page.tsx              Interactive dashboard (thesis → basket → backtest → execute → portfolio)
│   └── api/
│       ├── thesis/route.ts       POST: build basket + execution plan
│       ├── backtest/route.ts     POST: backtest + Monte Carlo + scenario stress tests (Wave 2)
│       ├── execute/route.ts      POST: place orders on SoDEX (explicit confirm flag required)
│       └── portfolio/route.ts    GET: portfolio + pending rebalance proposals
├── lib/
│   ├── sosovalue.ts              Typed SoSoValue API client (news, flows, SSI, metrics)
│   ├── sodex.ts                  Typed SoDEX client + execution-plan builder + currentNetwork()
│   ├── agent.ts                  Thesis classifier + risk-aware scoring + softmax weights
│   ├── historical.ts             Deterministic 180d daily-return seeds for the universe (Wave 2)
│   ├── backtest.ts               Daily-rebalanced backtest + risk-metric kernel (Wave 2)
│   ├── montecarlo.ts             Bootstrap MC simulator with VaR / CVaR (Wave 2)
│   ├── scenarios.ts              COVID / FTX / ETH-ETF stress-test replay (Wave 2)
│   ├── wallet.ts                 EIP-4361 SIWE flow over window.ethereum (Wave 2)
│   ├── storage.ts                Per-wallet basket persistence + snapshots (Wave 2)
│   ├── mock.ts                   Deterministic in-memory data so the demo never breaks
│   ├── types.ts                  Shared domain types
│   └── utils.ts
├── components/
│   ├── landing/                  Hero / Problem / HowItWorks / LiveData / AgenticLoop / WhyMosaic / CTA / Footer / Navbar
│   ├── dashboard/                ThesisInput / BasketProposal / BacktestPanel / MonteCarloPanel /
│   │                             StressTestPanel / ExecutionPreview / Portfolio / MyBaskets /
│   │                             WalletButton / ProductTour / AgentLog
│   └── ui/                       button / card / badge / input / progress
└── tailwind.config.ts            Custom dark-glass theme
```

### Data sources, end to end

| Surface | SoSoValue endpoint | Used in |
|---|---|---|
| Featured news (currency-filtered) | `GET /api/v1/news/featured/currency` | Landing live feed, rebalance citations, sentiment input |
| ETF spot flows | `GET /api/v1/etf/spot/{asset}/flow` | Landing flow chart, rebalance citations |
| SSI list / composition | `GET /api/v1/index/{symbol}` | Benchmark mapping, MAG7.ssi card on landing |
| Token metrics | `GET /api/v1/token/{symbol}/metrics` | Universe scoring (momentum, sentiment, vol, liquidity) |

| Surface | SoDEX endpoint | Used in |
|---|---|---|
| List markets | `GET /v1/public/markets` | Routing layer for any SoSoValue ticker into a SoDEX pair |
| Orderbook depth (8 levels) | `GET /v1/public/depth?symbol=…` | `estimateFill` for slippage-bps preview |
| Place IOC limit order | `POST /v1/orders` | Execution (HMAC-SHA256-signed) |
| Account positions | `GET /v1/account/positions` | Portfolio panel |

---

## Quickstart

```bash
# 1. install
cd mosaic
npm install

# 2. configure
cp .env.local.example .env.local
# fill in SOSOVALUE_API_KEY, SODEX_API_KEY, SODEX_API_SECRET
# (or leave blank to run on the deterministic mock layer)

# 3. dev
npm run dev          # http://localhost:3000

# 4. typecheck + production build
npm run typecheck
npm run build

# Smoke-test the agent + API-client logic in isolation:
npm run typecheck:libs   # checks only lib/*.ts, no Next/React deps required
```

### Environment

| Variable | Required | Purpose |
|---|---|---|
| `SOSOVALUE_API_KEY` | optional | Live SoSoValue API. Falls back to mocks if missing. |
| `SODEX_API_KEY` / `SODEX_API_SECRET` | optional | SoDEX auth — testnet by default. |
| `MOSAIC_NETWORK` | optional | `testnet` (default, safe) or `mainnet`. Picks the SoDEX base URL automatically. |
| `NEXT_PUBLIC_MOSAIC_NETWORK` | optional | Same value as above, exposed to the browser so the navbar can show the live network badge. |
| `SODEX_BASE_URL` | optional | Overrides the network-picked URL if set. |
| `ANTHROPIC_API_KEY` | optional | Use Claude Haiku for thesis interpretation. Falls back to keyword classifier. |
| `MOSAIC_USE_MOCKS` | optional | Force mock layer (`true`/`false`). |

---

## Mapped to the judging rubric

| Criterion | Weight | How Mosaic addresses it |
|---|---|---|
| **User Value & Practical Impact** | 30% | Solves the workflow retail can't do alone: building, executing, and maintaining a thematic crypto portfolio. Plain-English in, on-chain index out. |
| **Functionality & Working Demo** | 25% | End-to-end live: thesis form → agent log → basket card with weights and rationale → SoDEX execution preview with slippage-bps → portfolio panel with rebalance proposals. |
| **Logic, Workflow & Product Design** | 20% | Four-stage agentic loop with citations on every proposal. Risk-aware scoring kernel, concentration caps, IOC-only orders, explicit confirm gates. |
| **Data / API Integration** | 15% | 5 SoSoValue surfaces (news, ETF flow, SSI list, SSI composition, token metrics) + 4 SoDEX endpoints (markets, depth, place order, positions). Typed clients with mock fallback. |
| **UX & Clarity** | 10% | Single-screen dashboard, dark-glass aesthetic, agent log streams reasoning, every irreversible action carries a review step. |

---

## What makes this submission different

Most agentic-trading hackathon entries are *signal bots* — they say "buy X". Mosaic is a
*portfolio architect*. It treats SoSoValue's SSI protocol as a design pattern: take a
thesis, decompose into themes, score and weight a basket with risk caps, and route as
*one execution plan* through SoDEX's orderbook. That positioning is what unlocks all five
rubric criteria simultaneously, and it leans directly on the differentiated parts of
SoSoValue (indices, news, flows) and SoDEX (orderbook depth, IOC routing) rather than
treating them as generic price oracles.

---

## Roadmap

### Wave 2 — Build Phase May 23 – Jun 7, 2026 — see [`WAVE2.md`](./WAVE2.md)

Direct response to each Wave 1 judge critique, plus an execution-quality and
clarity pass for Wave 2. Shipping:

- **Backtest + Monte Carlo + stress tests** (answers jzddd's "needs backtesting + risk metrics + stress tests")
- **Per-wallet basket persistence + realised-return tracking** (answers SmartCoded's "thesis vs one-week realised return")
- **Inline first-run product tour** + **zero-setup one-click demo theses** (answers MuhammadBa's "onboarding tutorial")
- **WalletConnect-style SIWE identity**
- **Live SoDEX testnet wiring** + mainnet env-flagged path
- **Self-playing hero product preview**, **plain-English help on every metric**, a **`/judges` guide** and a live **`/diag`** integration-status page

### Wave 3

- `@reown/appkit` WalletConnect (mobile + hardware wallets)
- Supabase-backed persistence + server-side snapshotter
- Mainnet SoDEX execution under delegated session keys
- Mosaic agent publishes its own SSI-style index for follow trading

### Demo Day

- Live thesis → on-chain rebalance against testnet, end-to-end, in under 60 seconds.

---

## Submission package

- **Repo** — https://github.com/j12s-team/mosaic
- **Live demo** — https://mosaic-ivory.vercel.app
- **Judge's guide** — https://mosaic-ivory.vercel.app/judges
- **Live integration status** — https://mosaic-ivory.vercel.app/diag
- **Video** — submitted with the Wave 2 entry.
- **Team** — solo build (one-person business empire) by Rivaldo.
- **Wave changelog** — see top of repo.

## License

Proprietary — all rights reserved. Source is publicly visible solely for SoSoValue
Buildathon evaluation; see `LICENSE`. Built by [Rivaldo](https://github.com/janneh2000).
