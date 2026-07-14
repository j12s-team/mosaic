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

function nonce() {
  return Math.random().toString(36).slice(2, 18);
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
  const message = buildSiweMessage({ domain, address, chainId, nonce: nonce(), issuedAt });

  const signature = (await window.ethereum.request({
    method: "personal_sign",
    params: [message, address],
  })) as string;

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
