"use client";

import { useEffect, useState } from "react";
import { Badge } from "@mosaic/ui/badge";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Droplets,
  ExternalLink,
  Loader2,
  WifiOff,
} from "lucide-react";

interface Health {
  network: "testnet" | "mainnet";
  mode: string;
  sodex: {
    reachable: boolean;
    latencyMs: number;
    status?: number;
    error?: string;
    apiKeyPresent: boolean;
    apiSecretPresent: boolean;
  };
  sosovalue: { apiKeyPresent: boolean };
  timestamp: string;
}

export function HealthBanner() {
  const [data, setData] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-outline-variant bg-surface-container-low dark:bg-surface-container-low px-4 py-2 text-xs text-on-surface-variant">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking SoDEX connectivity…
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-error/30 bg-error/5 px-4 py-2 text-xs text-error">
        <WifiOff className="h-3 w-3" />
        Health probe failed.
      </div>
    );
  }

  const live = data.sodex.reachable && data.sodex.apiKeyPresent && data.sodex.apiSecretPresent;
  const reachableNoAuth = data.sodex.reachable && !data.sodex.apiKeyPresent;

  return (
    <div className="rounded-md border border-outline-variant bg-surface-container-low dark:bg-surface-container-low p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 brand-label">
          <Activity className="h-3 w-3" />
          Status
        </span>
        <Badge
          variant={
            live ? "success" : reachableNoAuth ? "warning" : "danger"
          }
          className="text-[10px]"
        >
          {live ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : reachableNoAuth ? (
            <AlertTriangle className="h-3 w-3" />
          ) : (
            <WifiOff className="h-3 w-3" />
          )}
          SoDEX {data.network} · {data.mode}
        </Badge>
        <Badge variant="brand" className="text-[10px]">
          public ping {data.sodex.latencyMs}ms{data.sodex.status ? ` · ${data.sodex.status}` : ""}
        </Badge>
        <Badge variant={data.sosovalue.apiKeyPresent ? "success" : "outline"} className="text-[10px]">
          SoSoValue API {data.sosovalue.apiKeyPresent ? "configured" : "mock-fallback"}
        </Badge>
      </div>

      {data.network === "testnet" && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
          <Droplets className="h-3 w-3 text-primary" />
          Need testnet tokens?{" "}
          <a
            href="https://testnet.sodex.com/faucet"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
          >
            SoDEX faucet
            <ExternalLink className="h-3 w-3" />
          </a>
          · Claim up to 1,000 USDC test tokens daily.
        </div>
      )}

      {!live && !reachableNoAuth && (
        <p className="mt-2 text-[11px] text-error">
          SoDEX is unreachable from this host. Check your network, then verify{" "}
          <code className="rounded bg-surface-container px-1 py-0.5 font-mono text-[10px]">MOSAIC_NETWORK</code> and{" "}
          <code className="rounded bg-surface-container px-1 py-0.5 font-mono text-[10px]">SODEX_BASE_URL</code>.
          {data.sodex.error ? ` ${data.sodex.error}` : ""}
        </p>
      )}
      {reachableNoAuth && (
        <p className="mt-2 text-[11px] text-warning">
          SoDEX endpoint is reachable but no API key is configured — orders will route to the
          deterministic mock layer. Add{" "}
          <code className="rounded bg-surface-container px-1 py-0.5 font-mono text-[10px]">SODEX_API_KEY</code> and{" "}
          <code className="rounded bg-surface-container px-1 py-0.5 font-mono text-[10px]">SODEX_API_SECRET</code>{" "}
          in your .env.local to flip live.
        </p>
      )}
    </div>
  );
}
