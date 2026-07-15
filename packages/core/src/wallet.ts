// Minimal SIWE (EIP-4361) sign-in over window.ethereum.
//
// Wave 2 ships this as a deliberately tiny client-only flow so we don't drag
// in megabytes of WalletConnect SDK code for the Buildathon demo. The proper
// @reown/appkit upgrade is roadmapped for Wave 3 to support non-injected
// wallets (mobile / hardware).

const STORAGE_KEY = "mosaic.session";

export interface MosaicSession {
  address: string;
  chainId: number;
  signedAt: string;
  domain: string;
  /** SIWE statement we asked the user to sign. */
  statement: string;
  /** Signature over the prepared EIP-4361 message. */
  signature: string;
}

declare global {
  // window.ethereum is added by browser wallets like MetaMask.
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

function buildSiweMessage(args: {
  domain: string;
  address: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
}) {
  return [
    `${args.domain} wants you to sign in with your Ethereum account:`,
    args.address,
    "",
    "Sign in to Mosaic — your personal crypto hedge fund, run by an agent.",
    "",
    `URI: https://${args.domain}`,
    `Version: 1`,
    `Chain ID: ${args.chainId}`,
    `Nonce: ${args.nonce}`,
    `Issued At: ${args.issuedAt}`,
  ].join("\n");
}

function localNonce() {
  return Math.random().toString(36).slice(2, 18);
}

/**
 * 5a: ask the server for a nonce. Returns null when server sessions are
 * disabled (no SESSION_SECRET) — the flow then degrades to the legacy
 * client-only session.
 */
async function fetchServerNonce(): Promise<string | null> {
  try {
    const r = await fetch("/api/auth/nonce");
    if (!r.ok) return null;
    const d = (await r.json()) as { enabled?: boolean; nonce?: string };
    return d.enabled && d.nonce ? d.nonce : null;
  } catch {
    return null;
  }
}

export async function connectWallet(): Promise<MosaicSession> {
  if (typeof window === "undefined") throw new Error("Browser-only");
  if (!window.ethereum) throw new Error("No injected wallet found. Install MetaMask or use a browser with a wallet extension.");

  const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts.length) throw new Error("No account exposed.");
  const address = accounts[0];

  const chainIdHex = (await window.ethereum.request({ method: "eth_chainId" })) as string;
  const chainId = parseInt(chainIdHex, 16);

  const domain = typeof window !== "undefined" ? window.location.host : "mosaic.local";
  const issuedAt = new Date().toISOString();
  const statement = "Sign in to Mosaic — your personal crypto hedge fund, run by an agent.";
  const serverNonce = await fetchServerNonce();
  const message = buildSiweMessage({
    domain,
    address,
    chainId,
    nonce: serverNonce ?? localNonce(),
    issuedAt,
  });

  const signature = (await window.ethereum.request({
    method: "personal_sign",
    params: [message, address],
  })) as string;

  // 5a: establish the server-verified session (httpOnly cookie). If the
  // server rejects the proof, fail loudly — a wallet-owned session must not
  // silently downgrade to client-asserted identity.
  if (serverNonce) {
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, signature }),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(
        (detail as { error?: string }).error ?? "Server rejected the sign-in signature."
      );
    }
  }

  const session: MosaicSession = {
    address,
    chainId,
    signedAt: issuedAt,
    domain,
    statement,
    signature,
  };
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }
  return session;
}

export function disconnectWallet() {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
  // Clear the server session too (fire-and-forget).
  try {
    void fetch("/api/auth/logout", { method: "POST" });
  } catch {
    /* offline is fine */
  }
}

export function getSession(): MosaicSession | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MosaicSession;
  } catch {
    return null;
  }
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
