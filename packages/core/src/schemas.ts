// Shared request schemas — single source of truth for client-side input
// enforcement AND server-side route validation (PLAN.md Phase 4).
// If a bound changes here, the char counter, the slider and the API agree.

import { z } from "zod";

export const THESIS_PROMPT_MIN = 8;
export const THESIS_PROMPT_MAX = 500;
export const AMOUNT_USD_MIN = 10;
export const AMOUNT_USD_MAX = 10_000_000;

export const RiskLevelSchema = z.enum(["conservative", "balanced", "aggressive"]);

export const ThesisRequestSchema = z.object({
  prompt: z.string().min(THESIS_PROMPT_MIN).max(THESIS_PROMPT_MAX),
  amountUsd: z.number().min(AMOUNT_USD_MIN).max(AMOUNT_USD_MAX),
  risk: RiskLevelSchema,
});
export type ThesisRequest = z.infer<typeof ThesisRequestSchema>;

export const MirrorRequestSchema = z.object({
  slug: z.string().min(1).max(80),
  amountUsd: z.number().min(AMOUNT_USD_MIN).max(AMOUNT_USD_MAX),
});
export type MirrorRequest = z.infer<typeof MirrorRequestSchema>;

export const SsiBuildRequestSchema = z.object({
  symbol: z.string().min(2).max(40),
  amountUsd: z.number().min(AMOUNT_USD_MIN).max(AMOUNT_USD_MAX),
  risk: RiskLevelSchema,
});
export type SsiBuildRequest = z.infer<typeof SsiBuildRequestSchema>;

// /api/backtest — previously the only body-accepting route without a schema
// (AUDIT.md §5). Constituents are shape-checked here; deep basket validation
// stays the responsibility of the analytics kernel.
export const BacktestRequestSchema = z.object({
  basket: z.object({
    constituents: z
      .array(z.object({ symbol: z.string().min(1).max(20) }).passthrough())
      .min(1)
      .max(30),
  }).passthrough(),
  horizonDays: z.number().int().min(7).max(365).optional(),
});
