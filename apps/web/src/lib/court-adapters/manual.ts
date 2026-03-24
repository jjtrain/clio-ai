import type { CourtAdapter, CourtEventData } from "./types";

export const ManualAdapter: CourtAdapter = {
  name: "MANUAL",

  async fetchEvents(): Promise<CourtEventData[]> {
    // Manual events are entered by hand — no-op
    return [];
  },

  async validateCredentials(): Promise<boolean> {
    return true;
  },
};
