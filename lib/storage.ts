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
