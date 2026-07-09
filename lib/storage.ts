// Basket persistence + realised-return tracking.
//
// The interface here is deliberately DB-shaped so a Supabase / Postgres swap
// is one file. Today we back it with localStorage so the demo works fully
// client-side without any infra setup.
//
// Records are scoped by wallet address. The "house" key (no wallet) gets its
// own namespace so the demo still works pre-connection.

import type { Basket } from "./types";

const VERSION = 1;

function keyFor(owner: string, kind: "baskets" | "snapshots") {
  return `mosaic.v${VERSION}.${owner.toLowerCase()}.${kind}`;
}

export interface SavedBasket {
  basket: Basket;
  /** Initial notional + per-leg fill prices captured at execution. */
  execution: {
    executedAt: string;
    notionalUsd: number;
    fills: Array<{ symbol: string; price: number; weight: number }>;
  };
  /** ISO timestamp of when this basket was saved. */
  savedAt: string;
  /** Live status: 'active' means snapshots keep being recorded. */
  status: "active" | "closed";
  /** Optional label the user can set. */
  label?: string;
}

export interface BasketSnapshot {
  basketId: string;
  takenAt: string;
  marketValueUsd: number;
  pnlUsd: number;
  pnlPct: number;
  /** Per-symbol prices at snapshot time (server snapshots only) — the cron
   *  uses these as the baseline for the next valuation. */
  prices?: Record<string, number>;
}

function read<T>(key: string): T[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, value: T[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function listBaskets(owner: string): SavedBasket[] {
  return read<SavedBasket>(keyFor(owner, "baskets")).sort((a, b) =>
    b.savedAt.localeCompare(a.savedAt),
  );
}

export function getBasket(owner: string, basketId: string): SavedBasket | null {
  return listBaskets(owner).find((b) => b.basket.id === basketId) ?? null;
}

export function saveBasket(owner: string, record: SavedBasket) {
  const key = keyFor(owner, "baskets");
  const all = read<SavedBasket>(key).filter((b) => b.basket.id !== record.basket.id);
  all.push(record);
  write(key, all);
}

export function closeBasket(owner: string, basketId: string) {
  const key = keyFor(owner, "baskets");
  const all = read<SavedBasket>(key).map((b) =>
    b.basket.id === basketId ? { ...b, status: "closed" as const } : b,
  );
  write(key, all);
}

export function getSnapshots(owner: string, basketId: string): BasketSnapshot[] {
  return read<BasketSnapshot>(keyFor(owner, "snapshots"))
    .filter((s) => s.basketId === basketId)
    .sort((a, b) => a.takenAt.localeCompare(b.takenAt));
}

const MIN_SNAPSHOT_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

export function appendSnapshot(owner: string, snap: BasketSnapshot) {
  const key = keyFor(owner, "snapshots");
  const all = read<BasketSnapshot>(key);
  const prior = all
    .filter((s) => s.basketId === snap.basketId)
    .sort((a, b) => b.takenAt.localeCompare(a.takenAt))[0];
  if (prior && Date.now() - new Date(prior.takenAt).getTime() < MIN_SNAPSHOT_INTERVAL_MS) {
    return false; // rate-limit
  }
  all.push(snap);
  write(key, all);
  return true;
}

/**
 * Compute "thesis vs realised" — uses the saved execution prices as the
 * predicted baseline, then walks the snapshot series to derive the realised
 * trajectory.
 */
export function predictedVsRealised(owner: string, basketId: string) {
  const saved = getBasket(owner, basketId);
  if (!saved) return null;
  const snaps = getSnapshots(owner, basketId);
  const realisedSeries = snaps.map((s) => ({
    t: s.takenAt,
    realised: +(s.marketValueUsd / saved.execution.notionalUsd - 1).toFixed(4),
  }));
  const last = realisedSeries[realisedSeries.length - 1];
  return {
    saved,
    snapshots: snaps,
    realisedSeries,
    daysHeld: realisedSeries.length
      ? Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(saved.execution.executedAt).getTime()) / (24 * 3600 * 1000),
          ),
        )
      : 0,
    realisedReturnPct: last ? +(last.realised * 100).toFixed(2) : 0,
  };
}

/** "House" namespace for unconnected users. */
export const HOUSE_OWNER = "house";

// ---------------------------------------------------------------------------
// Server persistence sync (durable-track-records).
//
// When DATABASE_URL is configured server-side, the API routes under
// /api/baskets become the source of truth; localStorage stays as a local
// cache so all existing sync call sites keep working. Without a database the
// app behaves exactly as before, fully client-side.
// ---------------------------------------------------------------------------

let serverMode: boolean | null = null;

/** Synchronous view of the last probe (false until a probe completes). */
export function isServerMode(): boolean {
  return serverMode === true;
}

/** Ask the server whether durable persistence is enabled (cached). */
export async function probeServer(): Promise<boolean> {
  if (serverMode !== null) return serverMode;
  if (typeof fetch === "undefined") return (serverMode = false);
  try {
    const res = await fetch("/api/baskets?probe=1");
    const data = await res.json();
    serverMode = Boolean(data.enabled);
  } catch {
    serverMode = false;
  }
  return serverMode;
}

export interface RemoteBasketMeta {
  isPublic: boolean;
  slug: string | null;
}

const remoteMeta = new Map<string, RemoteBasketMeta>();

/** Public flag / slug for a basket as last seen from the server. */
export function getRemoteMeta(basketId: string): RemoteBasketMeta | null {
  return remoteMeta.get(basketId) ?? null;
}

/**
 * Two-way sync with the server:
 *  1. Pull server baskets + snapshots into the localStorage cache
 *     (server data wins on conflicts — it is the durable record).
 *  2. Push any local-only baskets up (idempotent import keyed by basket id).
 * Returns true when the server is the active backend.
 */
export async function syncWithServer(owner: string): Promise<boolean> {
  if (!(await probeServer())) return false;
  try {
    const res = await fetch(`/api/baskets?owner=${encodeURIComponent(owner)}&snapshots=1`);
    if (!res.ok) return true;
    const data: {
      baskets: Array<{ record: SavedBasket; isPublic: boolean; slug: string | null }>;
      snapshots: Record<string, BasketSnapshot[]>;
    } = await res.json();

    const serverIds = new Set(data.baskets.map((b) => b.record.basket.id));

    // Push local-only baskets (one-time import; harmless to re-run).
    for (const local of listBaskets(owner)) {
      if (!serverIds.has(local.basket.id)) {
        await fetch("/api/baskets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ owner, record: local }),
        }).catch(() => undefined);
      }
    }

    // Pull server records into the local cache.
    for (const b of data.baskets) {
      saveBasket(owner, b.record);
      remoteMeta.set(b.record.basket.id, { isPublic: b.isPublic, slug: b.slug });
    }
    // Server snapshots replace the local series wholesale (they are chained).
    const key = keyFor(owner, "snapshots");
    const untouched = read<BasketSnapshot>(key).filter((s) => !(s.basketId in data.snapshots));
    const serverSnaps = Object.values(data.snapshots).flat();
    write(key, [...untouched, ...serverSnaps]);
  } catch {
    // best-effort: cache stays as-is
  }
  return true;
}

/** Save locally and, when the server backend is active, persist remotely too. */
export async function saveBasketEverywhere(owner: string, record: SavedBasket): Promise<void> {
  saveBasket(owner, record);
  if (await probeServer()) {
    await fetch("/api/baskets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner, record }),
    }).catch(() => undefined);
  }
}

/** Close locally + remotely. */
export async function closeBasketEverywhere(owner: string, basketId: string): Promise<void> {
  closeBasket(owner, basketId);
  if (await probeServer()) {
    await fetch(`/api/baskets/${encodeURIComponent(basketId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner, action: "close" }),
    }).catch(() => undefined);
  }
}

/** Toggle public visibility; returns the public slug when published. */
export async function setBasketPublic(
  owner: string,
  basketId: string,
  isPublic: boolean,
): Promise<string | null> {
  if (!(await probeServer())) return null;
  try {
    const res = await fetch(`/api/baskets/${encodeURIComponent(basketId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner, action: "setPublic", public: isPublic }),
    });
    const data = await res.json();
    remoteMeta.set(basketId, { isPublic, slug: data.slug ?? null });
    return (data.slug as string) ?? null;
  } catch {
    return null;
  }
}
