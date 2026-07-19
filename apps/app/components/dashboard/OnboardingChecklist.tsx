"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@mosaic/ui/card";
import { Badge } from "@mosaic/ui/badge";
import { CheckCircle2, Circle, Droplets, ExternalLink, Rocket, Wallet, Wand2 } from "lucide-react";
import { getSession } from "@mosaic/core/wallet";
import { HOUSE_OWNER, listBaskets } from "@mosaic/core/storage";

interface StepState {
  walletConnected: boolean;
  faucetClaimed: boolean;
  basketBuilt: boolean;
  basketExecuted: boolean;
}

const STORAGE_KEY = "mosaic.onboarding";

function loadState(): StepState {
  if (typeof localStorage === "undefined") {
    return { walletConnected: false, faucetClaimed: false, basketBuilt: false, basketExecuted: false };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as StepState;
  } catch {
    /* noop */
  }
  return { walletConnected: false, faucetClaimed: false, basketBuilt: false, basketExecuted: false };
}

function saveState(s: StepState) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

/**
 * Sticky 4-step onboarding card. Auto-detects wallet connection and saved
 * baskets so it ticks itself off as the user progresses. The faucet step is
 * a manual checkbox because we can't introspect SoDEX testnet drips from
 * the frontend.
 */
export function OnboardingChecklist() {
  const [state, setState] = useState<StepState>({
    walletConnected: false,
    faucetClaimed: false,
    basketBuilt: false,
    basketExecuted: false,
  });
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const persisted = loadState();
    const session = getSession();
    const owner = session?.address ?? HOUSE_OWNER;
    const baskets = listBaskets(owner);
    const next: StepState = {
      walletConnected: Boolean(session),
      faucetClaimed: persisted.faucetClaimed,
      basketBuilt: baskets.length > 0 || persisted.basketBuilt,
      basketExecuted: baskets.some((b) => b.execution?.notionalUsd > 0) || persisted.basketExecuted,
    };
    setState(next);
    saveState(next);
  }, []);

  const allDone = state.walletConnected && state.faucetClaimed && state.basketBuilt && state.basketExecuted;
  const completed = [state.walletConnected, state.faucetClaimed, state.basketBuilt, state.basketExecuted].filter(Boolean).length;

  if (allDone && collapsed) return null;

  function markFaucet() {
    const next = { ...state, faucetClaimed: !state.faucetClaimed };
    setState(next);
    saveState(next);
  }

  return (
    <Card className="border-primary/20 bg-primary/[0.04]">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-primary" />
            Get started in 4 steps
          </CardTitle>
          <p className="mt-1 text-xs text-on-surface-variant">
            {completed}/4 complete · SoDEX testnet is free, no real funds at risk.
          </p>
        </div>
        {allDone && (
          <button
            onClick={() => setCollapsed(true)}
            className="brand-label hover:text-on-surface"
          >
            Hide
          </button>
        )}
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          <Step
            done={state.walletConnected}
            icon={Wallet}
            title="Connect your wallet"
            help="Use the Connect button in the navbar — MetaMask, Rabby, or any injected EVM wallet works on SoDEX testnet."
          />
          <Step
            done={state.faucetClaimed}
            icon={Droplets}
            title="Claim testnet USDC"
            help="The faucet drops up to 1,000 USDC per day per address. Required before you can execute baskets."
            action={
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href="https://testnet.sodex.com/faucet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-sm border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] text-primary hover:bg-primary/20"
                >
                  Open faucet <ExternalLink className="h-3 w-3" />
                </a>
                <button
                  onClick={markFaucet}
                  className="brand-label hover:text-on-surface"
                >
                  {state.faucetClaimed ? "Unmark" : "I've claimed"}
                </button>
              </div>
            }
          />
          <Step
            done={state.basketBuilt}
            icon={Wand2}
            title="Build your first basket"
            help={`Type a thesis above or load an SSI index. Mosaic decomposes your prompt into themes, scores ${'~'}20 candidate tokens on SoSoValue momentum / sentiment / liquidity, and proposes a weighted basket.`}
          />
          <Step
            done={state.basketExecuted}
            icon={Rocket}
            title="Route to SoDEX"
            help="Approve the IOC limit plan. Mosaic currently simulates the fills locally; EIP-712 signing to land real orders on the SoDEX testnet orderbook is the next milestone on the roadmap."
          />
        </ol>
        {allDone && (
          <div className="mt-4 rounded-sm border border-success/30 bg-success/[0.06] p-3 text-xs text-success">
            <Badge variant="success" className="text-[10px]">All set</Badge>{" "}
            You're done with onboarding. The dashboard now reflects your live SoDEX wallet and
            saved baskets.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Step({
  done,
  icon: Icon,
  title,
  help,
  action,
}: {
  done: boolean;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  help: string;
  action?: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      {done ? (
        <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-success" />
      ) : (
        <Circle className="h-5 w-5 flex-shrink-0 text-on-surface-variant" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-primary" />
          <span className={`text-sm font-medium ${done ? "text-on-surface-variant line-through" : ""}`}>
            {title}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] leading-relaxed text-on-surface-variant">{help}</p>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </li>
  );
}
