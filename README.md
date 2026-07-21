# Mosaic — your personal crypto hedge fund, run by an agent

> **SoSoValue Buildathon** · Wave 3 ✓
>
> **Live:** https://mosaic-ivory.vercel.app ·
>
> An agentic on-chain index manager: describe a thesis in plain English, Mosaic constructs
> a thematic portfolio from SoSoValue data, executes it through the SoDEX orderbook, and
> proposes rebalances when the underlying signals shift — with the user in the confirm loop.
>
> **Wave 3 ships:** Wave 3 — Production hardening: real execution, monorepo, and a full brand system
This wave took Mosaic from a hackathon demo to a production-grade dApp. Highlights:
Critical fix — trades now execute for real. We found and killed a "simulated-as-real" bug: confirmed trades reported success while nothing hit SoDEX. Two silent fallbacks were at fault — the execute route returned HTTP 200 even when every live order threw, and the portfolio persisted plan estimates instead of actual fills. Now a confirmed trade places a real EIP-712-signed order on SoDEX, portfolio state updates only from confirmed fills, failures surface the real error (no fake success), and demo mode is explicitly labeled. Verified against the official SoDEX REST/signing docs; added regression tests asserting a failed live call can never return a simulated fill.
Mainnet-ready. Network is pure config (MOSAIC_NETWORK) selecting gateway + chainId; testnet→mainnet needs zero code changes. Added layered safety rails (mainnet enable flag, dry-run, global notional cap, kill switch) and a diagnostic that checks whether the SoDEX trading key is registered for the wallet on the active network.
Architecture. Split the single app into a pnpm + Turborepo monorepo: apps/site (marketing), apps/app (platform + APIs), packages/core (agent, clients, backtest/Monte Carlo, mandates, snapshot chain), packages/ui (MD3 design system). Two independently deployable Vercel apps.
Security & auth. Server-verified SIWE sessions (HMAC httpOnly cookies, EIP-191 recovery, replay-safe nonces); wallet-owned data is now bound to a verified session, closing an impersonation gap.
Design system. Rebuilt the landing as a high-conversion brand page (void canvas, spectrum gradients, Michroma wordmark, agentic-loop + live-data proof), then brought the identity into the app as a brand shell with MD3 controls. Added a "mosaic" interaction language: baskets render as a tile weight-map (each tile a position, sized by weight), tessellation entrance motion, and a rebalance pulse — all compositor-only and reduced-motion-safe. Canonical per-asset colors (BTC gold, ETH blue, SOL purple…) with luminance-based label contrast.
Product polish. PWA with offline read-only portfolio (market/execution endpoints never cached); PostHog funnel (thesis→basket→backtest→mandate→execution); shared zod validation across client and server; collapsible mandate history capped to the last 10.
Governance. All work tracked via OpenSpec change proposals and a design spec; strategy docs and licensing updated.

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
mosaic/                           pnpm + Turborepo monorepo (wave3/dapp)
├── apps/
│   ├── site/                     Marketing/landing site (server-rendered live SoSoValue data)
│   │   ├── app/page.tsx          Landing page
│   │   └── components/landing/   Hero / Problem / HowItWorks / LiveData / AgenticLoop / …
│   └── app/                      The platform (wallet-connected dApp)
│       ├── app/page.tsx          Dashboard (thesis → basket → backtest → execute → portfolio)
│       ├── app/b/                Shared/public basket pages
│       ├── app/status/           Internal integration diagnostics (token-gated in prod)
│       ├── app/api/              thesis / backtest / execute / portfolio / baskets /
│       │                         mandate / verify / mirror / ssi / market-pulse /
│       │                         explain / cron/snapshot / diag / health
│       └── components/dashboard/ ThesisInput / BasketProposal / BacktestPanel / MandateCard / …
├── packages/
│   ├── core/                     @mosaic/core — the engine (framework-free TypeScript)
│   │   └── src/                  agent / sosovalue / sodex / backtest / montecarlo /
│   │                             scenarios / mandate / eip712 / wallet / storage / db /
│   │                             snapshotChain / share / mock / types / utils
│   └── ui/                       @mosaic/ui — design system (MD3 tokens, primitives,
│                                 ThemeToggle, chart palette, Tailwind preset, styles.css)
├── turbo.json                    Task pipeline (build / typecheck / test / dev)
└── pnpm-workspace.yaml
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
# 1. install (pnpm via corepack)
cd mosaic
corepack enable
pnpm install

# 2. configure
cp apps/app/.env.local.example apps/app/.env.local
# fill in SOSOVALUE_API_KEY, SODEX_API_KEY, SODEX_API_SECRET
# (or leave blank to run on the deterministic mock layer)

# 3. dev — platform on :3000, marketing site on :3001
pnpm dev                          # both, via turbo
pnpm --filter @mosaic/app dev     # platform only
pnpm --filter @mosaic/site dev    # site only

# 4. typecheck + tests + production build
pnpm typecheck
pnpm test
pnpm build
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



## Mosaic — Post-Buildathon Roadmap

> Grounded in what shipped on `wave3/dapp`. Four tracks, sequenced by
> dependency: **rename → security review → rebalancing → partnerships.**
> Rename and security come first because they gate everything that touches
> real funds and public branding.

---

### 1. Name change

The current name is a trademark risk — "Mosaic" is heavily used across
software and finance, which makes it hard to protect and easy to confuse.
Resolve before any marketing spend, custom domain, or mainnet launch, since a
later rename is far more expensive once users, track records, and on-chain
identity are attached.

- **Now:** trademark + domain availability search in target markets; shortlist
  distinctive, ownable names; decide keep-vs-rename with counsel.
- **On rename:** the visual identity (5×5 luminous mark, spectrum, motion) is
  name-agnostic and mostly survives; swap only the wordmark, `.env` public
  URLs, metadata/OG, `DESIGN.md` positioning line, and repo/package names.
  File a trademark for the chosen mark + wordmark.
- **Guardrail:** lock the name before the first paid offering and before any
  vault/contract is deployed with the name baked in.

### 2. Security best practices review

We hardened auth this wave (server-verified SIWE sessions, wallet-bound data,
zod validation, real-vs-demo execution with honest errors, dry-run + notional
caps + kill switch). The next pass formalizes the rest before scaling notional.

- **Secrets:** the SoDEX API secret is an EVM private key — move it out of flat
  env into a managed secret store (Vercel/KMS), scope it to trade-only, and
  rotate every credential that ever lived in a local file. Add a CI secret
  scanner + pre-commit hook so nothing leaks into the (public) repo.
- **Custody & trust model:** today the mandate bounds *Mosaic's server*
  authority over an API-keyed account. Document this plainly, then execute the
  delegated-session-key spike (already scripted) so trade authority is scoped
  and revocable at the venue — the path toward non-custodial vaults.
- **App hardening:** CSRF on mutating routes, per-wallet rate limits, an
  audited residual/partial-fill path, and a written incident runbook for the
  kill switch.
- **Independent review:** third-party security review of the execution path
  before raising `MOSAIC_GLOBAL_MAX_NOTIONAL`; smart-contract audit becomes a
  gate once vaults exist.

### 3. Baskets rebalancing

The four-stage loop already *proposes* rebalances with citations; the
snapshotter and residual-proposal plumbing exist. Next is closing the loop
into bounded, hands-off maintenance.

- **Near:** drift- and signal-triggered proposals surfaced in-app with a veto
  window; one-click approve routing through the same real SoDEX path shipped
  this wave. Rebalance history + realised-vs-target tracking.
- **Mid:** autonomous rebalancing under a signed mandate — the server executes
  within notional/slippage/cooldown/drift limits after the veto window, no
  click required, fully audited. Cost-aware execution (slippage budget,
  skip-below-threshold) so churn never eats returns.
- **Long:** portfolio-level rebalancing across multiple baskets; scheduled
  cadences; optional publish of a Mosaic-managed SSI-style index others mirror.

### 4. Partnerships

Mosaic sits on SoSoValue data + SoDEX execution — deepen both, then extend.

- **SoSoValue:** formalize data access/quota, co-marketing, and position
  Mosaic as an agentic index layer on their indices.
- **SoDEX:** delegated session keys for non-custodial trading, listing/liquidity
  alignment for basket constituents, and a B2B path to embed the
  thesis→basket→execute UX in their surface.
- **Wallets:** WalletConnect / `@reown/appkit` for mobile + hardware wallets
  beyond injected providers.
- **B2B / ecosystem:** white-label the agent for exchanges and data platforms;
  explore creator/curator partners once the mirror marketplace opens.

---

### Sequencing at a glance

| Track | Now (0–1mo) | Mid (1–3mo) | Long (3mo+) |
|---|---|---|---|
| Rename | search + decide | rebrand assets | trademark filed |
| Security | secrets + CI scanner | delegated keys, CSRF/rate-limit | external review/audit |
| Rebalancing | veto-window proposals | autonomous mandated rebalance | multi-basket + index |
| Partnerships | SoSoValue/SoDEX terms | WalletConnect, delegated keys | white-label / marketplace |


- Live thesis → on-chain rebalance against testnet, end-to-end, in under 60 seconds.

---

## Submission package

- **Repo** — https://github.com/j12s-team/mosaic
- **Live demo** — https://mosaic-ivory.vercel.app
- **Judge's guide** — https://mosaic-ivory.vercel.app/judges
- **Live integration status** — https://mosaic-ivory.vercel.app/diag
- **Video** — https://youtu.be/UGpdBQuPziA.
- **Team** — j12s team.
- **Wave changelog** — see top of repo.

## License

Proprietary — all rights reserved. Source is publicly visible solely for SoSoValue
Buildathon evaluation; see `LICENSE`. Built by (https://github.com/j12s).
