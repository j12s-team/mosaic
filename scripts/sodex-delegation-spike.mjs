#!/usr/bin/env node
// SoDEX delegation spike (PLAN.md 5-spike) — run LOCALLY with approved keys:
//
//   MOSAIC_NETWORK=testnet \
//   SODEX_API_KEY=… SODEX_API_SECRET=… [SODEX_ACCOUNT_ID=…] \
//   node scripts/sodex-delegation-spike.mjs
//
// Purpose: answer the ONE question that decides Option C (execution fees on
// users' own accounts): can a second, scoped key act on a SoDEX account that
// isn't Mosaic's? Testnet first. Mainnet only after the dry-run protocol.
//
// This script is read-only: it places NO orders.

const NET = process.env.MOSAIC_NETWORK === "mainnet" ? "mainnet" : "testnet";
const BASE = process.env.SODEX_BASE_URL ?? `https://${NET}-gw.sodex.dev`;
const KEY = process.env.SODEX_API_KEY;

const results = [];
async function probe(name, path, opts = {}) {
  const url = `${BASE}${path}`;
  try {
    const res = await fetch(url, {
      headers: KEY ? { "X-API-Key": KEY } : {},
      ...opts,
    });
    let body = null;
    try { body = await res.json(); } catch { /* non-JSON */ }
    results.push({ name, url, status: res.status, ok: res.ok, sample: JSON.stringify(body)?.slice(0, 160) });
  } catch (err) {
    results.push({ name, url, status: "unreachable", ok: false, sample: String(err.message ?? err) });
  }
}

console.log(`\n=== SoDEX delegation spike · ${NET} · ${BASE} ===\n`);

// 1. Reachability + public surface (no auth)
await probe("public markets", "/v1/public/markets");
await probe("public tickers", "/markets/tickers");

// 2. Authenticated account surface (needs SODEX_API_KEY)
if (KEY) {
  await probe("account state (key identity)", "/v1/account/state");
  await probe("account positions", "/v1/account/positions");
  // 3. Key-management surface — existence of these endpoints IS the finding.
  //    (Paths are educated guesses; confirm against the SoDEX whitepaper/docs.)
  await probe("list API keys (?)", "/v1/account/apiKeys");
  await probe("list API keys alt (?)", "/v1/account/keys");
  await probe("subaccounts (?)", "/v1/account/subaccounts");
} else {
  console.log("SODEX_API_KEY not set — skipping authenticated probes.\n");
}

console.table(results.map(({ name, status, ok, sample }) => ({ name, status, ok, sample })));

console.log(`
=== Findings checklist (fill in after running + reading SoDEX docs) ===

[ ] 1. Can a SoDEX account register MORE THAN ONE API key?
[ ] 2. Can a key be scoped (trade-only / no-withdrawal / per-market)?
[ ] 3. Can key registration be done via API, or only via the SoDEX UI?
[ ] 4. Does an order signed by key B on account A carry any on-venue record
       of WHICH key placed it (audit trail for mandate enforcement)?
[ ] 5. Rate limits / notional caps per key?
[ ] 6. ToS: is operating a third-party execution service against user
       accounts permitted? (blocker — legal review)

Decision rule (PLAN.md 5b):
  1–3 yes → Option C viable as designed (user registers a scoped key for
             Mosaic; the EIP-712 mandate bounds what Mosaic's server may do).
  1 or 3 no → Option C needs SoDEX cooperation (B2B conversation) or waits
             for Option B's on-chain vaults.
`);
