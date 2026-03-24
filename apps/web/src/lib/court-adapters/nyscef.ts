import type { CourtAdapter, CourtEventData } from "./types";

/**
 * NYSCEF adapter — stub for future implementation.
 * New York State Courts Electronic Filing system.
 * Today: use ICS import from NYSCEF case pages (export .ics from case detail).
 * Future: scrape or API when available.
 */
export const NYSCEFAdapter: CourtAdapter = {
  name: "NYSCEF",

  async fetchEvents(_caseNumber: string, _credentials?: any): Promise<CourtEventData[]> {
    throw new Error(
      "NYSCEF direct integration is not yet implemented. " +
      "Use ICS Import instead — NYSCEF case pages export .ics calendar files. " +
      "Go to the NYSCEF case page → Calendar → Export .ics → Upload here."
    );
  },

  async validateCredentials(credentials: any): Promise<boolean> {
    if (!credentials?.username || !credentials?.password) {
      return false;
    }
    console.log("[NYSCEF] Credential validation not yet implemented");
    return false;
  },
};
