"use client";

// Investment mandate panel — bounded autonomy, made visible.
//
// The user signs one EIP-712 mandate per basket (human-readable terms in
// the wallet prompt). The server enforces the envelope on every mainnet
// execution and this card shows exactly how much authority remains:
// utilisation vs cap, expiry, instant revoke, and the global kill switch.

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@mosaic/ui/card";
import { Badge } from "@mosaic/ui/badge";
import { Button } from "@mosaic/ui/button";
import { Progress } from "@mosaic/ui/progress";
import { InfoHint } from "@mosaic/ui/info-hint";
import { getSession } from "@mosaic/core/wallet";
import { mandateTypedData, type Mandate, type MandateTerms } from "@mosaic/core/mandate";
import type { Basket } from "@mosaic/core/types";
import { ShieldCheck, OctagonX, FileSignature } from "lucide-react";

type MandateWithUse = Mandate & {
  utilisation: { filledNotionalUsd: number; lastExecutionAt?: string };
};

export function MandateCard({ basket, amountUsd }: { basket: Basket | null; amountUsd: number }) {
  const [wallet, setWallet] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [mandates, setMandates] = useState<MandateWithUse[]>([]);
  const [killSwitch, setKillSwitch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (addr: string) => {
    try {
      const res = await fetch(`/api/mandate?wallet=${addr}`);
      const data = await res.json();
      setEnabled(Boolean(data.enabled));
      setMandates(data.mandates ?? []);
      setKillSwitch(Boolean(data.killSwitch));
    } catch {
      /* panel stays in its last state */
    }
  }, []);

  /** Tell other panels (ExecutionPreview) that mandate state changed. */
  const broadcast = useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mosaic:mandates-changed"));
    }
  }, []);

  useEffect(() => {
    const s = getSession();
    if (s?.address) {
      setWallet(s.address);
      refresh(s.address);
    }
  }, [refresh]);

  async function signMandate() {
    if (!wallet || !basket || !window.ethereum) return;
    setBusy(true);
    setError(null);
    try {
      const terms: MandateTerms = {
        wallet,
        basketId: basket.id,
        maxNotionalUsd: Math.max(10, Math.round(amountUsd)),
        allowedSymbols: basket.constituents.map((c) => c.symbol.toUpperCase()),
        maxSlippageBps: 50,
        maxDriftBps: 100,
        cooldownHours: 24,
        vetoWindowHours: 24,
        expiry: Math.floor(Date.now() / 1000) + 30 * 86400,
        nonce: Date.now(),
      };
      const typed = mandateTypedData(terms);
      const signature = (await window.ethereum.request({
        method: "eth_signTypedData_v4",
        params: [wallet, JSON.stringify(typed)],
      })) as string;
      const res = await fetch("/api/mandate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terms, signature }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "mandate rejected");
      await refresh(wallet);
      broadcast();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!wallet) return;
    await fetch("/api/mandate", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke", wallet, id }),
    }).catch(() => undefined);
    await refresh(wallet);
    broadcast();
  }

  async function toggleKillSwitch() {
    if (!wallet) return;
    await fetch("/api/mandate", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "killSwitch", wallet, on: !killSwitch }),
    }).catch(() => undefined);
    await refresh(wallet);
    broadcast();
  }

  if (!wallet || !enabled) return null;

  return (
    <Card data-tour="mandate">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Investment mandates
          <InfoHint
            label="Mandate"
            text="A signed, bounded grant of authority: the agent can only execute inside your caps (notional, tokens, slippage, cooldown) and you can revoke it instantly."
          />
        </CardTitle>
        <CardDescription>
          The agent&apos;s mainnet authority, in your handwriting. Every execution is checked
          against these terms server-side and logged.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {mandates.length === 0 && (
          <p className="text-body-md text-on-surface-variant">
            No mandates yet. Build a basket, then sign a mandate to allow mainnet execution
            within your limits.
          </p>
        )}

        {mandates.map((m) => {
          const used = m.utilisation.filledNotionalUsd;
          const pct = Math.min(100, (used / m.maxNotionalUsd) * 100);
          const expired = Date.now() / 1000 > m.expiry;
          return (
            <div
              key={m.id}
              className="rounded-md border border-outline-variant bg-surface-container p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={m.status === "active" && !expired ? "success" : "outline"}
                  >
                    {m.status === "revoked" ? "revoked" : expired ? "expired" : "active"}
                  </Badge>
                  <span className="font-mono text-label-md text-on-surface-variant">
                    {m.basketId.slice(0, 24)}
                  </span>
                </div>
                {m.status === "active" && !expired && (
                  <button
                    type="button"
                    onClick={() => revoke(m.id)}
                    className="text-label-md text-error underline-offset-4 hover:underline"
                  >
                    revoke
                  </button>
                )}
              </div>
              <div className="mt-2 text-label-md text-on-surface-variant">
                ${used.toLocaleString()} used of ${m.maxNotionalUsd.toLocaleString()} cap ·{" "}
                {m.allowedSymbols.length} tokens · ≤{m.maxSlippageBps} bps slip ·{" "}
                {m.cooldownHours}h cooldown · {m.vetoWindowHours}h veto window
              </div>
              <Progress value={pct} className="mt-2" />
              <div className="mt-1 text-label-md text-on-surface-variant">
                Expires {new Date(m.expiry * 1000).toLocaleDateString()}
              </div>
            </div>
          );
        })}

        {basket && (
          <Button className="w-full" onClick={signMandate} disabled={busy}>
            <FileSignature className="h-4 w-4" />
            {busy ? "Waiting for wallet…" : `Sign mandate for this basket ($${Math.round(amountUsd).toLocaleString()} cap)`}
          </Button>
        )}
        {error && <p className="text-label-md text-error">{error}</p>}

        <div className="flex items-center justify-between rounded-md border border-outline-variant bg-surface-container p-3">
          <div className="flex items-center gap-2 text-body-md">
            <OctagonX className={`h-4 w-4 ${killSwitch ? "text-error" : "text-on-surface-variant"}`} />
            <span>
              Kill switch{" "}
              <span className={killSwitch ? "text-error" : "text-on-surface-variant"}>
                {killSwitch ? "ENGAGED — all execution blocked" : "off"}
              </span>
            </span>
          </div>
          <Button
            size="sm"
            variant={killSwitch ? "tonal" : "error"}
            onClick={toggleKillSwitch}
          >
            {killSwitch ? "Release" : "Engage"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
