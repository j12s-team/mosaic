import posthog from "posthog-js";

/**
 * Product funnel events (PLAN.md Phase 4):
 *   thesis_submitted → basket_proposed → backtest_run
 *     → mandate_signed → execution_confirmed   (+ basket_mirrored)
 * No-ops unless NEXT_PUBLIC_POSTHOG_KEY is set.
 */
export function track(event: string, props?: Record<string, unknown>) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try {
    posthog.capture(event, props);
  } catch {
    /* analytics must never break the product */
  }
}
