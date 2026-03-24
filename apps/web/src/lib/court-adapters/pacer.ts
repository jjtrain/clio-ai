import type { CourtAdapter, CourtEventData } from "./types";

/**
 * PACER adapter — stub for future implementation.
 * Requires PACER credentials (login + password) and per-page fees.
 */
export const PACERAdapter: CourtAdapter = {
  name: "PACER",

  async fetchEvents(_caseNumber: string, _credentials?: any): Promise<CourtEventData[]> {
    throw new Error(
      "PACER integration is not yet implemented. " +
      "PACER requires a registered account and charges per-page fees. " +
      "Configure credentials in Court Integrations when ready."
    );
  },

  async validateCredentials(credentials: any): Promise<boolean> {
    if (!credentials?.username || !credentials?.password) {
      return false;
    }
    // Future: validate against PACER login endpoint
    console.log("[PACER] Credential validation not yet implemented");
    return false;
  },
};
