/**
 * Beta mode helper for GoalIQ.
 *
 * Reads VITE_BETA_MODE env var. Default true (failsafe).
 * In beta mode:
 * - Stripe UI (pricing/billing/upgrade) is hidden
 * - TrialGate becomes passthrough (no paywall)
 * - All features accessible without subscription
 *
 * To disable beta mode (V2 commercial launch):
 *   VITE_BETA_MODE=false in .env
 */
export const isBetaMode = (): boolean => {
  const value = import.meta.env.VITE_BETA_MODE;
  // Default to TRUE (failsafe): if env var missing → beta mode
  if (value === undefined) return true;
  // Explicitly false only if "false" string
  return value !== "false";
};
