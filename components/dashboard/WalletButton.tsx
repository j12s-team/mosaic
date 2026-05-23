"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  connectWallet,
  disconnectWallet,
  getSession,
  shortAddress,
  type MosaicSession,
} from "@/lib/wallet";
import { Wallet, LogOut, Loader2 } from "lucide-react";

export function WalletButton() {
  const [session, setSession] = useState<MosaicSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSession(getSession());
  }, []);

  async function onConnect() {
    setError(null);
    setBusy(true);
    try {
      const s = await connectWallet();
      setSession(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function onDisconnect() {
    disconnectWallet();
    setSession(null);
  }

  if (session) {
    return (
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs md:flex">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          <span className="font-mono text-emerald-700 dark:text-emerald-200">{shortAddress(session.address)}</span>
        </div>
        <Button size="icon" variant="ghost" onClick={onDisconnect} title="Disconnect" className="md:size-sm">
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="secondary" onClick={onConnect} disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wallet className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">{busy ? "Signing…" : "Connect wallet"}</span>
      </Button>
      {error && (
        <p className="max-w-[16rem] text-right text-[10px] text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
