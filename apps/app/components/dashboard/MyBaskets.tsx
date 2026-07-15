"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@mosaic/ui/card";
import { MosaicTiles } from "@/components/dashboard/MosaicTiles";
import { Badge } from "@mosaic/ui/badge";
import { formatPct, formatUSD } from "@mosaic/core/utils";
import { getSession } from "@mosaic/core/wallet";
import {
  HOUSE_OWNER,
  listBaskets,
  predictedVsRealised,
  syncWithServer,
  setBasketPublic,
  deleteBasketEverywhere,
  getRemoteMeta,
  type SavedBasket,
} from "@mosaic/core/storage";
import { seedHouseBasketsIfNeeded } from "@mosaic/core/houseBaskets";
import { useChartColors, tooltipStyle } from "@mosaic/ui/chartColors";
import { Bookmark, ChevronDown, ChevronRight, Sparkles, Globe, Link2, CloudUpload, Trash2, RotateCcw } from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function MyBaskets() {
  const cc = useChartColors();
  const [owner, setOwner] = useState<string>(HOUSE_OWNER);
  const [baskets, setBaskets] = useState<SavedBasket[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [cloud, setCloud] = useState(false);
  const [publicSlugs, setPublicSlugs] = useState<Record<string, string | null>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  function refresh() {
    setBaskets(listBaskets(owner));
  }

  useEffect(() => {
    // Seed the house namespace with 3 demo baskets + 7d snapshot history
    // so first-time users see a realised-return curve immediately.
    seedHouseBasketsIfNeeded();
    const s = getSession();
    setOwner(s?.address ?? HOUSE_OWNER);
  }, []);

  // Two-way sync with the durable backend (no-op when DATABASE_URL is off):
  // pulls server baskets + chained snapshots into the local cache and pushes
  // any local-only baskets up (one-time idempotent import).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const active = await syncWithServer(owner);
      if (cancelled) return;
      setCloud(active);
      if (active) {
        setBaskets(listBaskets(owner));
        const slugs: Record<string, string | null> = {};
        for (const b of listBaskets(owner)) {
          const meta = getRemoteMeta(b.basket.id);
          if (meta?.isPublic) slugs[b.basket.id] = meta.slug;
        }
        setPublicSlugs(slugs);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [owner]);

  async function togglePublic(basketId: string) {
    const isPublic = basketId in publicSlugs;
    const slug = await setBasketPublic(owner, basketId, !isPublic);
    setPublicSlugs((prev) => {
      const next = { ...prev };
      if (isPublic) delete next[basketId];
      else next[basketId] = slug;
      return next;
    });
  }

  async function removeBasket(basketId: string) {
    if (confirmingDelete !== basketId) {
      setConfirmingDelete(basketId);
      setTimeout(() => setConfirmingDelete((c) => (c === basketId ? null : c)), 4000);
      return;
    }
    setConfirmingDelete(null);
    await deleteBasketEverywhere(owner, basketId);
    setPublicSlugs((prev) => {
      const next = { ...prev };
      delete next[basketId];
      return next;
    });
    refresh();
  }

  function restoreDemoBaskets() {
    // Clear the seed flag so the seeder runs again, then reseed + refresh.
    localStorage.removeItem("mosaic.house.seeded.v2");
    seedHouseBasketsIfNeeded();
    refresh();
  }

  async function copyPublicLink(basketId: string) {
    const slug = publicSlugs[basketId];
    if (!slug) return;
    const url = `${window.location.origin}/b/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(basketId);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      // clipboard unavailable — the link is still visible in the UI
    }
  }

  useEffect(() => {
    const rows = listBaskets(owner);
    setBaskets(rows);
    // Default behaviour: expand the most recently saved basket so users
    // immediately see the fills without having to click. Older baskets stay
    // collapsed to keep the panel scannable.
    if (rows[0]) {
      setExpanded((prev) => ({ ...prev, [rows[0].basket.id]: prev[rows[0].basket.id] ?? true }));
    }

    // Live refresh when ExecutionPreview saves a new basket: it dispatches a
    // window event so the newly-executed basket appears here immediately,
    // auto-expanded and scrolled into view, with no page refresh.
    const onSaved = (e: Event) => {
      const rows2 = listBaskets(owner);
      setBaskets(rows2);
      const detail = (e as CustomEvent).detail as { basketId?: string } | undefined;
      const targetId = detail?.basketId ?? rows2[0]?.basket.id;
      if (targetId) {
        setExpanded((prev) => ({ ...prev, [targetId]: true }));
        setTimeout(() => {
          const el = document.getElementById(`basket-${targetId}`);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 120);
      }
    };
    window.addEventListener("mosaic:basket-executed", onSaved);
    return () => window.removeEventListener("mosaic:basket-executed", onSaved);
  }, [owner]);

  if (baskets.length === 0) {
    return (
      <Card id="saved-baskets">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-primary" />
            Your saved baskets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-dashed border-outline-variant bg-surface-container p-8 text-center text-sm text-on-surface-variant">
            <Sparkles className="mx-auto h-5 w-5 text-primary/60" />
            <p className="mt-2">
              No saved baskets yet. Build one above and hit{" "}
              <span className="font-medium text-on-surface">Confirm &amp; execute</span> —
              we&apos;ll start snapshotting it for thesis-vs-realised tracking.
            </p>
            <p className="mt-2 text-[11px]">
              Owner: <span className="font-mono">{owner === HOUSE_OWNER ? "house (unconnected)" : owner.slice(0, 6) + "…" + owner.slice(-4)}</span>
            </p>
            {owner === HOUSE_OWNER && (
              <button
                type="button"
                onClick={restoreDemoBaskets}
                className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full border border-outline px-3 py-1 text-[11px] text-on-surface-variant transition hover:text-on-surface"
              >
                <RotateCcw className="h-3 w-3" />
                Restore demo baskets
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="saved-baskets">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-primary" />
          Your saved baskets ({baskets.length})
          {cloud && (
            <Badge variant="brand" className="ml-1">
              <CloudUpload className="h-3 w-3" />
              synced
            </Badge>
          )}
        </CardTitle>
        <p className="mt-1 text-xs text-on-surface-variant">
          Thesis, fills, and realised return — tracked since the moment you executed. Click a
          basket to expand the per-leg fills Mosaic routed through SoDEX.
          {cloud &&
            " Snapshots are recorded server-side daily and hash-chained, so your track record accrues even with the tab closed."}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {baskets.map((b) => {
          const pvr = predictedVsRealised(owner, b.basket.id);
          const realised = pvr?.realisedReturnPct ?? 0;
          const isOpen = expanded[b.basket.id] ?? false;
          return (
            <div
              key={b.basket.id}
              id={`basket-${b.basket.id}`}
              className="rounded-md border border-outline-variant bg-surface-container p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setExpanded((p) => ({ ...p, [b.basket.id]: !isOpen }))}
                  className="-m-1 flex-1 rounded p-1 text-left transition hover:bg-surface-container-high"
                >
                  <div className="flex items-center gap-2">
                    {isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5 text-on-surface-variant" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-on-surface-variant" />
                    )}
                    <Badge variant={b.status === "active" ? "success" : "outline"}>
                      {b.status}
                    </Badge>
                    {b.basket.benchmark && (
                      <Badge variant="brand">vs {b.basket.benchmark.symbol}</Badge>
                    )}
                    <span className="text-[11px] text-on-surface-variant">
                      {b.basket.constituents.length} legs · {pvr?.daysHeld ?? 0}d held
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-snug">&ldquo;{b.basket.thesis.prompt}&rdquo;</p>
                  <div className="mt-2">
                    <MosaicTiles basket={b.basket} compact />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {b.execution.fills.slice(0, 6).map((f) => (
                      <span
                        key={f.symbol}
                        className="rounded-sm border border-outline-variant bg-surface-container-low px-1.5 py-0.5 font-mono text-[10px] text-on-surface-variant"
                      >
                        {f.symbol} <span className="text-on-surface">{(f.weight * 100).toFixed(0)}%</span>
                      </span>
                    ))}
                    {b.execution.fills.length > 6 && (
                      <span className="rounded-sm border border-outline-variant bg-surface-container-low px-1.5 py-0.5 font-mono text-[10px] text-on-surface-variant">
                        +{b.execution.fills.length - 6} more
                      </span>
                    )}
                  </div>
                </button>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-on-surface-variant">
                    Realised
                  </div>
                  <div
                    className={`font-mono text-lg font-semibold ${
                      realised >= 0 ? "text-success " : "text-error "
                    }`}
                  >
                    {formatPct(realised / 100, { signed: true })}
                  </div>
                  <div className="text-[10px] text-on-surface-variant">
                    on {formatUSD(b.execution.notionalUsd)}
                  </div>
                  <div className="mt-2 flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => removeBasket(b.basket.id)}
                      title="Permanently delete this basket and its history"
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition ${
                        confirmingDelete === b.basket.id
                          ? "border-transparent bg-error-container text-on-error-container"
                          : "border-outline text-on-surface-variant hover:text-error"
                      }`}
                    >
                      <Trash2 className="h-3 w-3" />
                      {confirmingDelete === b.basket.id ? "confirm delete?" : "remove"}
                    </button>
                  {cloud && (
                    <>
                      <button
                        type="button"
                        onClick={() => togglePublic(b.basket.id)}
                        title={
                          b.basket.id in publicSlugs
                            ? "Make private"
                            : "Publish a public, verifiable track-record page"
                        }
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition ${
                          b.basket.id in publicSlugs
                            ? "border-transparent bg-primary-container text-on-primary-container"
                            : "border-outline text-on-surface-variant hover:text-on-surface"
                        }`}
                      >
                        <Globe className="h-3 w-3" />
                        {b.basket.id in publicSlugs ? "public" : "publish"}
                      </button>
                      {b.basket.id in publicSlugs && publicSlugs[b.basket.id] && (
                        <button
                          type="button"
                          onClick={() => copyPublicLink(b.basket.id)}
                          title="Copy public link"
                          className="inline-flex items-center gap-1 rounded-full border border-outline px-2 py-0.5 text-[10px] text-on-surface-variant transition hover:text-on-surface"
                        >
                          <Link2 className="h-3 w-3" />
                          {copied === b.basket.id ? "copied!" : "link"}
                        </button>
                      )}
                    </>
                  )}
                  </div>
                </div>
              </div>

              {isOpen && (
                <div className="mt-4 rounded-md border border-outline-variant bg-surface-container">
                  <div className="flex items-center justify-between border-b border-outline-variant px-3 py-2 text-[10px] uppercase tracking-wider text-on-surface-variant">
                    <span>Executed fills · {new Date(b.execution.executedAt).toLocaleString()}</span>
                    <span>{formatUSD(b.execution.notionalUsd)} total</span>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-container text-[10px] uppercase tracking-wider text-on-surface-variant">
                      <tr>
                        <th className="px-3 py-2">Asset</th>
                        <th className="px-3 py-2 text-right">Weight</th>
                        <th className="px-3 py-2 text-right">Fill price</th>
                        <th className="px-3 py-2 text-right">Notional</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/60">
                      {b.execution.fills.map((f) => (
                        <tr key={f.symbol}>
                          <td className="px-3 py-2 font-medium">{f.symbol}</td>
                          <td className="px-3 py-2 text-right font-mono">
                            {(f.weight * 100).toFixed(1)}%
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {f.price > 0
                              ? f.price < 1
                                ? `$${f.price.toFixed(4)}`
                                : `$${f.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {formatUSD(b.execution.notionalUsd * f.weight)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="border-t border-outline-variant px-3 py-2 text-[10px] text-on-surface-variant">
                    Fills recorded locally · realised PnL tracked from these entry prices.
                  </div>
                </div>
              )}

              {pvr && pvr.realisedSeries.length > 1 && (
                <div className="mt-3 h-16">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={pvr.realisedSeries} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id={`rr-${b.basket.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={realised >= 0 ? cc.success : cc.error} stopOpacity={0.4} />
                          <stop offset="100%" stopColor={realised >= 0 ? cc.success : cc.error} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="realised"
                        stroke={realised >= 0 ? cc.success : cc.error}
                        strokeWidth={1.5}
                        fill={`url(#rr-${b.basket.id})`}
                        isAnimationActive={false}
                      />
                      <XAxis dataKey="t" hide />
                      <YAxis hide domain={["auto", "auto"]} />
                      <Tooltip
                        contentStyle={tooltipStyle(cc)}
                        labelFormatter={(v) => new Date(v).toLocaleString()}
                        formatter={(v: number) => [formatPct(v), "Realised"]}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
