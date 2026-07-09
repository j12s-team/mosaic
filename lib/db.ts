// Server-side persistence — Neon serverless Postgres.
//
// This module is the only place that talks to the database. It is
// server-only (imported by API routes and server components). The client
// keeps using lib/storage.ts, which syncs through /api/baskets.
//
// Implementation note vs design.md D1: we use the raw @neondatabase/serverless
// driver with hand-written SQL instead of Drizzle — at five tables an ORM
// adds a dependency without pulling its weight. Revisit if the schema grows.

import { neon } from "@neondatabase/serverless";
import type { SavedBasket, BasketSnapshot } from "./storage";
import {
  GENESIS,
  computeSnapshotHash,
  signHash,
  verifyChain,
  type ChainRow,
  type ChainVerdict,
} from "./snapshotChain";

export function dbEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function sql() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not configured");
  return neon(process.env.DATABASE_URL);
}

let ensured = false;

/** Create tables on first use — idempotent, replaces a migration runner at this scale. */
export async function ensureSchema() {
  if (ensured) return;
  const q = sql();
  await q`CREATE TABLE IF NOT EXISTS baskets (
    id text PRIMARY KEY,
    owner text NOT NULL,
    record jsonb NOT NULL,
    status text NOT NULL DEFAULT 'active',
    is_public boolean NOT NULL DEFAULT false,
    slug text UNIQUE,
    mirrored_from text,
    saved_at timestamptz NOT NULL DEFAULT now()
  )`;
  await q`CREATE TABLE IF NOT EXISTS snapshots (
    id bigserial PRIMARY KEY,
    basket_id text NOT NULL,
    owner text NOT NULL,
    taken_at timestamptz NOT NULL,
    taken_at_iso text NOT NULL,
    market_value_usd numeric NOT NULL,
    pnl_usd numeric NOT NULL,
    pnl_pct numeric NOT NULL,
    prices jsonb,
    prev_hash text NOT NULL,
    hash text NOT NULL,
    signature text NOT NULL DEFAULT ''
  )`;
  await q`CREATE INDEX IF NOT EXISTS snapshots_basket_idx ON snapshots (basket_id, taken_at)`;
  await q`CREATE TABLE IF NOT EXISTS audit_log (
    id bigserial PRIMARY KEY,
    at timestamptz NOT NULL DEFAULT now(),
    actor text NOT NULL,
    action text NOT NULL,
    detail jsonb
  )`;
  // Reserved for the mainnet-mandate-execution change — created now so both
  // changes share one schema bootstrap.
  await q`CREATE TABLE IF NOT EXISTS mandates (
    id text PRIMARY KEY,
    wallet text NOT NULL,
    basket_id text NOT NULL,
    terms jsonb NOT NULL,
    signature text NOT NULL,
    status text NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await q`CREATE TABLE IF NOT EXISTS fills (
    id bigserial PRIMARY KEY,
    basket_id text NOT NULL,
    order_id text,
    leg jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await q`ALTER TABLE fills ADD COLUMN IF NOT EXISTS mandate_id text`;
  await q`CREATE TABLE IF NOT EXISTS proposals (
    id text PRIMARY KEY,
    basket_id text NOT NULL,
    mandate_id text,
    changes jsonb NOT NULL,
    veto_window_hours int NOT NULL DEFAULT 24,
    status text,
    proposed_at timestamptz NOT NULL DEFAULT now(),
    proposed_at_iso text NOT NULL
  )`;
  await q`CREATE TABLE IF NOT EXISTS settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  ensured = true;
}

function norm(owner: string) {
  return owner.toLowerCase();
}

export interface DbBasketRow {
  record: SavedBasket;
  owner: string;
  isPublic: boolean;
  slug: string | null;
  mirroredFrom: string | null;
}

function rowToBasket(r: Record<string, unknown>): DbBasketRow {
  const record = r.record as SavedBasket;
  // status column is authoritative (PATCH close updates it).
  record.status = (r.status as SavedBasket["status"]) ?? record.status;
  return {
    record,
    owner: r.owner as string,
    isPublic: Boolean(r.is_public),
    slug: (r.slug as string) ?? null,
    mirroredFrom: (r.mirrored_from as string) ?? null,
  };
}

export async function dbListBaskets(owner: string): Promise<DbBasketRow[]> {
  await ensureSchema();
  const rows = await sql()`
    SELECT * FROM baskets WHERE owner = ${norm(owner)} ORDER BY saved_at DESC`;
  return rows.map(rowToBasket);
}

export async function dbGetBasket(basketId: string): Promise<DbBasketRow | null> {
  await ensureSchema();
  const rows = await sql()`SELECT * FROM baskets WHERE id = ${basketId} LIMIT 1`;
  return rows.length ? rowToBasket(rows[0]) : null;
}

export async function dbGetPublicBasketBySlug(slug: string): Promise<DbBasketRow | null> {
  await ensureSchema();
  const rows = await sql()`
    SELECT * FROM baskets WHERE slug = ${slug} AND is_public = true LIMIT 1`;
  return rows.length ? rowToBasket(rows[0]) : null;
}

export async function dbListActiveBaskets(): Promise<DbBasketRow[]> {
  await ensureSchema();
  const rows = await sql()`SELECT * FROM baskets WHERE status = 'active'`;
  return rows.map(rowToBasket);
}

/** Idempotent upsert keyed by basket id. Creates a chained t=0 snapshot when none exist. */
export async function dbSaveBasket(
  owner: string,
  record: SavedBasket,
  opts: { mirroredFrom?: string } = {},
): Promise<void> {
  await ensureSchema();
  const q = sql();
  await q`
    INSERT INTO baskets (id, owner, record, status, mirrored_from, saved_at)
    VALUES (${record.basket.id}, ${norm(owner)}, ${JSON.stringify(record)}::jsonb,
            ${record.status}, ${opts.mirroredFrom ?? record.basket.mirroredFrom ?? null},
            ${record.savedAt})
    ON CONFLICT (id) DO UPDATE
      SET record = EXCLUDED.record, status = EXCLUDED.status`;
  const existing = await q`SELECT count(*)::int AS n FROM snapshots WHERE basket_id = ${record.basket.id}`;
  if ((existing[0]?.n ?? 0) === 0) {
    await dbAppendSnapshot(owner, {
      basketId: record.basket.id,
      takenAt: record.execution.executedAt,
      marketValueUsd: record.execution.notionalUsd,
      pnlUsd: 0,
      pnlPct: 0,
    });
  }
}

export async function dbCloseBasket(owner: string, basketId: string): Promise<void> {
  await ensureSchema();
  await sql()`
    UPDATE baskets SET status = 'closed'
    WHERE id = ${basketId} AND owner = ${norm(owner)}`;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Toggle public visibility; assigns a stable slug on first publish. */
export async function dbSetPublic(
  owner: string,
  basketId: string,
  isPublic: boolean,
): Promise<{ slug: string | null }> {
  await ensureSchema();
  const q = sql();
  const rows = await q`
    SELECT slug, record FROM baskets WHERE id = ${basketId} AND owner = ${norm(owner)} LIMIT 1`;
  if (!rows.length) return { slug: null };
  let slug = rows[0].slug as string | null;
  if (isPublic && !slug) {
    const record = rows[0].record as SavedBasket;
    const base =
      slugify(record.label ?? record.basket.thesis.prompt.slice(0, 30)) || "basket";
    slug = `${base}-${basketId.slice(-6).toLowerCase()}`;
  }
  await q`
    UPDATE baskets SET is_public = ${isPublic}, slug = ${slug}
    WHERE id = ${basketId} AND owner = ${norm(owner)}`;
  return { slug: isPublic ? slug : slug };
}

/** Append a snapshot with hash-chain + HMAC signature. Returns the stored hash. */
export async function dbAppendSnapshot(
  owner: string,
  snap: BasketSnapshot,
): Promise<string> {
  await ensureSchema();
  const q = sql();
  const prev = await q`
    SELECT hash FROM snapshots WHERE basket_id = ${snap.basketId}
    ORDER BY taken_at DESC, id DESC LIMIT 1`;
  const prevHash = (prev[0]?.hash as string) ?? GENESIS;
  const hash = computeSnapshotHash({
    basketId: snap.basketId,
    takenAt: snap.takenAt,
    marketValueUsd: snap.marketValueUsd,
    prices: snap.prices,
    prevHash,
  });
  const signature = signHash(hash);
  await q`
    INSERT INTO snapshots (basket_id, owner, taken_at, taken_at_iso, market_value_usd, pnl_usd, pnl_pct, prices, prev_hash, hash, signature)
    VALUES (${snap.basketId}, ${norm(owner)}, ${snap.takenAt}, ${snap.takenAt}, ${snap.marketValueUsd},
            ${snap.pnlUsd}, ${snap.pnlPct},
            ${snap.prices ? JSON.stringify(snap.prices) : null}::jsonb,
            ${prevHash}, ${hash}, ${signature})`;
  return hash;
}

export async function dbGetSnapshots(basketId: string): Promise<BasketSnapshot[]> {
  await ensureSchema();
  const rows = await sql()`
    SELECT * FROM snapshots WHERE basket_id = ${basketId} ORDER BY taken_at ASC, id ASC`;
  return rows.map((r) => ({
    basketId: r.basket_id as string,
    takenAt: r.taken_at_iso as string,
    marketValueUsd: Number(r.market_value_usd),
    pnlUsd: Number(r.pnl_usd),
    pnlPct: Number(r.pnl_pct),
    prices: (r.prices as Record<string, number>) ?? undefined,
  }));
}

export async function dbVerifyChain(basketId: string): Promise<ChainVerdict> {
  await ensureSchema();
  const rows = await sql()`
    SELECT * FROM snapshots WHERE basket_id = ${basketId} ORDER BY taken_at ASC, id ASC`;
  const chain: ChainRow[] = rows.map((r) => ({
    basketId: r.basket_id as string,
    takenAt: r.taken_at_iso as string,
    marketValueUsd: Number(r.market_value_usd),
    prices: (r.prices as Record<string, number>) ?? undefined,
    prevHash: r.prev_hash as string,
    hash: r.hash as string,
    signature: r.signature as string,
  }));
  return verifyChain(chain);
}

// ---------------------------------------------------------------------------
// Mandates, fills, kill switch, proposals (mainnet-mandate-execution)
// ---------------------------------------------------------------------------

import type { Mandate, MandateTerms } from "./mandate";

export async function dbSaveMandate(mandate: Mandate): Promise<void> {
  await ensureSchema();
  const { id, signature, status, createdAt, ...terms } = mandate;
  await sql()`
    INSERT INTO mandates (id, wallet, basket_id, terms, signature, status, created_at)
    VALUES (${id}, ${norm(mandate.wallet)}, ${mandate.basketId},
            ${JSON.stringify(terms)}::jsonb, ${signature}, ${status}, ${createdAt})
    ON CONFLICT (id) DO NOTHING`;
}

function rowToMandate(r: Record<string, unknown>): Mandate {
  const terms = r.terms as MandateTerms;
  return {
    ...terms,
    id: r.id as string,
    signature: r.signature as string,
    status: r.status as Mandate["status"],
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function dbListMandates(wallet: string): Promise<Mandate[]> {
  await ensureSchema();
  const rows = await sql()`
    SELECT * FROM mandates WHERE wallet = ${norm(wallet)} ORDER BY created_at DESC`;
  return rows.map(rowToMandate);
}

export async function dbGetMandate(id: string): Promise<Mandate | null> {
  await ensureSchema();
  const rows = await sql()`SELECT * FROM mandates WHERE id = ${id} LIMIT 1`;
  return rows.length ? rowToMandate(rows[0]) : null;
}

export async function dbRevokeMandate(wallet: string, id: string): Promise<boolean> {
  await ensureSchema();
  const rows = await sql()`
    UPDATE mandates SET status = 'revoked'
    WHERE id = ${id} AND wallet = ${norm(wallet)} RETURNING id`;
  return rows.length > 0;
}

export interface FillRecord {
  basketId: string;
  mandateId?: string;
  orderId?: string;
  leg: {
    market: string;
    side: string;
    requestedNotionalUsd: number;
    filledNotionalUsd: number;
    estPrice?: number;
    avgPrice?: number;
    estSlippageBps?: number;
    realisedSlippageBps?: number;
    simulated: boolean;
    dryRun?: boolean;
  };
}

export async function dbRecordFill(fill: FillRecord): Promise<void> {
  await ensureSchema();
  await sql()`
    INSERT INTO fills (basket_id, mandate_id, order_id, leg)
    VALUES (${fill.basketId}, ${fill.mandateId ?? null}, ${fill.orderId ?? null},
            ${JSON.stringify(fill.leg)}::jsonb)`;
}

/** Cumulative FILLED notional under a mandate (dry-run fills excluded). */
export async function dbMandateUtilisation(
  mandateId: string,
): Promise<{ filledNotionalUsd: number; lastExecutionAt?: string }> {
  await ensureSchema();
  const rows = await sql()`
    SELECT leg, created_at FROM fills WHERE mandate_id = ${mandateId}`;
  let filled = 0;
  let last: string | undefined;
  for (const r of rows) {
    const leg = r.leg as FillRecord["leg"];
    if (leg.dryRun) continue;
    filled += Number(leg.filledNotionalUsd) || 0;
    const at = new Date(r.created_at as string).toISOString();
    if (!last || at > last) last = at;
  }
  return { filledNotionalUsd: +filled.toFixed(2), lastExecutionAt: last };
}

/** Global kill switch: env override wins, else the settings table. */
export async function dbKillSwitch(): Promise<boolean> {
  if (process.env.MOSAIC_KILL_SWITCH === "1") return true;
  await ensureSchema();
  const rows = await sql()`SELECT value FROM settings WHERE key = 'killSwitch' LIMIT 1`;
  return rows.length ? Boolean((rows[0].value as { on?: boolean }).on) : false;
}

export async function dbSetKillSwitch(on: boolean, actor: string): Promise<void> {
  await ensureSchema();
  await sql()`
    INSERT INTO settings (key, value, updated_at)
    VALUES ('killSwitch', ${JSON.stringify({ on })}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
  await dbAudit(actor, on ? "kill-switch-on" : "kill-switch-off");
}

export interface ProposalRow {
  id: string;
  basketId: string;
  mandateId: string | null;
  changes: unknown;
  vetoWindowHours: number;
  status: "executed" | "vetoed" | null;
  proposedAt: string;
}

export async function dbCreateProposal(p: {
  id: string;
  basketId: string;
  mandateId?: string;
  changes: unknown;
  vetoWindowHours: number;
  proposedAt: string;
}): Promise<void> {
  await ensureSchema();
  await sql()`
    INSERT INTO proposals (id, basket_id, mandate_id, changes, veto_window_hours, proposed_at, proposed_at_iso)
    VALUES (${p.id}, ${p.basketId}, ${p.mandateId ?? null}, ${JSON.stringify(p.changes)}::jsonb,
            ${p.vetoWindowHours}, ${p.proposedAt}, ${p.proposedAt})
    ON CONFLICT (id) DO NOTHING`;
}

export async function dbSetProposalStatus(
  id: string,
  status: "executed" | "vetoed",
): Promise<void> {
  await ensureSchema();
  await sql()`UPDATE proposals SET status = ${status} WHERE id = ${id}`;
}

export async function dbListProposals(basketId: string): Promise<ProposalRow[]> {
  await ensureSchema();
  const rows = await sql()`
    SELECT * FROM proposals WHERE basket_id = ${basketId} ORDER BY proposed_at DESC`;
  return rows.map((r) => ({
    id: r.id as string,
    basketId: r.basket_id as string,
    mandateId: (r.mandate_id as string) ?? null,
    changes: r.changes,
    vetoWindowHours: Number(r.veto_window_hours),
    status: (r.status as ProposalRow["status"]) ?? null,
    proposedAt: r.proposed_at_iso as string,
  }));
}

export async function dbAudit(actor: string, action: string, detail?: unknown) {
  try {
    await ensureSchema();
    await sql()`
      INSERT INTO audit_log (actor, action, detail)
      VALUES (${actor}, ${action}, ${detail ? JSON.stringify(detail) : null}::jsonb)`;
  } catch {
    // audit must never take down the caller
  }
}
