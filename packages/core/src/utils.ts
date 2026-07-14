import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUSD(n: number, opts: { maxFrac?: number } = {}) {
  const max = opts.maxFrac ?? (n >= 1000 ? 0 : 2);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: max,
  }).format(n);
}

export function formatPct(n: number, opts: { signed?: boolean } = {}) {
  const sign = opts.signed && n > 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(2)}%`;
}

export function formatCompact(n: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(n);
}

export function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
