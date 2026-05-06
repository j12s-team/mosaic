# Wave 1 submission — Mosaic

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

- Repo: **https://github.com/janneh2000/mosaic**
- README with full setup, architecture, judging-criteria mapping, env vars: `README.md`
- Demo video script: `DEMO_SCRIPT.md`

## Demo

- Live demo URL: *insert Vercel URL after `vercel deploy`*
- Local: `npm install && npm run dev → http://localhost:3000`

## Video Introduction

- Script: see `DEMO_SCRIPT.md` (75–90 seconds)

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
