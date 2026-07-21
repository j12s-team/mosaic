# Mosaic — Post-Buildathon Roadmap

> Grounded in what shipped on `wave3/dapp`. Four tracks, sequenced by
> dependency: **rename → security review → rebalancing → partnerships.**
> Rename and security come first because they gate everything that touches
> real funds and public branding.

---

## 1. Name change

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

## 2. Security best practices review

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

## 3. Baskets rebalancing

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

## 4. Partnerships

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
