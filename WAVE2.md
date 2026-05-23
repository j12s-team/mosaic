# Wave 2 — direct response to judge feedback

Wave 1 closed with an average score of **~8.49 / 10** across seven voting judges.
Three themes came up in the substantive critiques:

| Voter | Critique | Wave 2 response |
|---|---|---|
| **jzddd** | "Early prototype with mock fallback. Portfolio construction logic needs stronger validation through backtesting, historical performance, risk metrics, rebalance analysis, and stress tests." | Full **backtest engine** (90d historical replay) + **risk metrics kernel** (Sharpe, Sortino, max drawdown, beta vs MAG7.ssi, realised vol) + **Monte Carlo simulator** (1,000-path bootstrap, VaR / CVaR) + **historical scenario stress tests** (Mar 2020 COVID, FTX Nov 2022, ETH ETF Jul 2024). Demo flips from mocks to real SoSoValue + SoDEX-testnet endpoints when keys are configured. |
| **SmartCoded** | "Make persistent baskets so users can compare thesis vs one-week realised return." | **WalletConnect / SIWE** identity. Baskets persisted per address. Background snapshotter records portfolio value daily; the dashboard surfaces predicted-vs-realised return on every saved basket. |
| **MuhammadBa_2024** | "Adding a simple onboarding guide or tutorial for first-time users would improve accessibility." | **Inline product tour** on first visit (dependency-free, dismissable, re-launchable from the navbar). Walks users through thesis → agent log → basket → backtest → execute → portfolio. |

We're also delivering on **two public commitments** made in the judge thread:

- "Next phase it will be live on testnet" → **live SoDEX testnet trading** via the existing typed client, gated by a `MOSAIC_NETWORK` flag with a visible network badge in the navbar.
- "And hopefully mainnet sson after wave 2" → **mainnet endpoint path** wired but env-flagged; on by default it's **testnet** for safe demo runs.

---

## What ships in Wave 2

### New analytical surface (the jzddd response)

- `lib/historical.ts` — 180-day daily-return seeds for every token in the universe. Deterministic, fully reproducible, and swap-friendly (production drop-in is SoSoValue's `/api/v1/token/{symbol}/history` once available).
- `lib/backtest.ts` — pure-function basket replay. Returns: cumulative return, Sharpe, Sortino, max drawdown (and date), beta vs MAG7.ssi, realised 30d vol, daily PnL series, drawdown series, win-rate.
- `lib/montecarlo.ts` — IID bootstrap from observed returns, 1,000 paths × 30 days. Returns: p10/p50/p90 path fan, VaR(95%), CVaR(95%), terminal-value histogram, prob of loss.
- `lib/scenarios.ts` — three named historical stress regimes. Replays the *current* basket weights against each regime's return matrix.

Three new UI panels stitched into the dashboard below the basket proposal:

- `BacktestPanel` — equity curve + drawdown shadow, headline-metric chips, hover tooltip with daily PnL.
- `MonteCarloPanel` — fan chart (p10/p50/p90) + terminal-value histogram + VaR/CVaR chips.
- `StressTestPanel` — three regime cards, each with PnL %, max DD, days underwater.

### Persistence + realised-return tracking (the SmartCoded response)

- `lib/wallet.ts` — thin SIWE flow: `eth_requestAccounts` → `personal_sign` of an EIP-4361 message → session in localStorage. The proper `@reown/appkit` WalletConnect upgrade is roadmapped for Wave 3.
- `lib/storage.ts` — DB-shaped storage interface (`getBaskets`, `saveBasket`, `getSnapshots`, `appendSnapshot`). LocalStorage backend ships today; Supabase / Postgres drop-in is one file.
- `components/dashboard/MyBaskets.tsx` — list of saved baskets for the connected wallet. Click into a basket to see *thesis text → predicted return → realised return → divergence chart*.
- A lightweight client-side snapshotter records portfolio value on each page mount (and at most every 6 hours per basket) so the realised series fills in over time.

### Onboarding (the MuhammadBa response)

- `components/dashboard/ProductTour.tsx` — 5-step overlay with element highlights, "Next / Back / Skip" controls. Auto-fires on first `/app` visit (gated by `localStorage["mosaic.tour.seen"]`), and a "Replay tour" button lives in the navbar overflow.

### Live trading + network flag

- `MOSAIC_NETWORK=testnet|mainnet` env var. The SoDEX client picks the correct base URL automatically.
- Navbar shows a live network badge with the chain.
- The `/api/execute` route refuses to place real orders unless `MOSAIC_NETWORK === "mainnet"` *and* a hard `confirm: "I-understand"` flag is sent. Testnet executes freely.

---

## Judging-criteria mapping, refreshed

| Criterion | Weight | Wave 1 → Wave 2 |
|---|---|---|
| User Value & Practical Impact | 30% | Same core thesis, now with quantified "what will this portfolio actually do?" before the user clicks execute. |
| Functionality & Working Demo | 25% | End-to-end live on testnet. Persistence means revisiting the app shows your prior baskets. |
| Logic, Workflow & Product Design | 20% | Adds the missing analytical layer: backtest + MC + stress before any irreversible action. Tour explains the workflow. |
| Data / API Integration | 15% | Live SoSoValue + SoDEX-testnet endpoints when configured. Same five SoSoValue surfaces + four SoDEX endpoints, plus a real historical-returns swap-in point. |
| UX & Clarity | 10% | Inline product tour; saved-basket realised-vs-thesis comparison; visible network badge. |

---

## Wave 3 roadmap (preserved)

- `@reown/appkit` proper WalletConnect (so non-injected wallets work).
- Supabase-backed persistence + server-driven snapshotter so realised-return tracking works without the user keeping a tab open.
- Mainnet SoDEX execution under delegated permissions (session keys).
- Mosaic agent that publishes its own SSI-style index for follow-trading.
- Hosted demo with a few "house-built" public baskets so first-time visitors see realised performance without needing to wait 7 days.
