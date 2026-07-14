// Encode / decode a basket payload into a URL-safe base64 string so any
// basket page can be shared with a single link — no backend required.
//
// Payload shape is `{ b: Basket, e?: { notionalUsd: number; executedAt: string } }`.
// We trim un-needed fields before encoding to keep URLs short.

import type { Basket } from "./types";

export interface SharePayload {
  basket: Basket;
  execution?: { notionalUsd: number; executedAt: string };
}

function toBase64Url(input: string): string {
  // Use the global atob/btoa-equivalent that works in both browser and Node.
  if (typeof Buffer !== "undefined") {
    return Buffer.from(input, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }
  // Browser fallback.
  return btoa(unescape(encodeURIComponent(input)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(input: string): string {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  if (typeof Buffer !== "undefined") {
    return Buffer.from(b64, "base64").toString("utf8");
  }
  return decodeURIComponent(escape(atob(b64)));
}

export function encodeShare(payload: SharePayload): string {
  const slim: SharePayload = {
    basket: {
      ...payload.basket,
      // Drop reasoning if it pushes us over 6KB — judges can re-fetch from /api/thesis.
      reasoning: payload.basket.reasoning?.slice(0, 600) ?? "",
      constituents: payload.basket.constituents.map((c) => ({
        ...c,
        // Keep only the lightweight metric subset.
        metrics: {
          momentum30d: c.metrics.momentum30d,
          sentiment: c.metrics.sentiment,
          volatility: c.metrics.volatility,
          liquidityScore: c.metrics.liquidityScore,
        },
      })),
    },
    execution: payload.execution,
  };
  return toBase64Url(JSON.stringify(slim));
}

export function decodeShare(encoded: string): SharePayload | null {
  try {
    return JSON.parse(fromBase64Url(encoded)) as SharePayload;
  } catch {
    return null;
  }
}

export function buildShareUrl(
  payload: SharePayload,
  origin?: string,
): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/b?d=${encodeShare(payload)}`;
}
