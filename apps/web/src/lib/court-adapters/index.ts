export type { CourtAdapter, CourtEventData } from "./types";
export { ManualAdapter } from "./manual";
export { ICSImportAdapter, parseICS } from "./ics-import";
export { CourtListenerAdapter } from "./courtlistener";
export { PACERAdapter } from "./pacer";
export { NYSCEFAdapter } from "./nyscef";

import type { CourtAdapter } from "./types";
import { ManualAdapter } from "./manual";
import { ICSImportAdapter } from "./ics-import";
import { CourtListenerAdapter } from "./courtlistener";
import { PACERAdapter } from "./pacer";
import { NYSCEFAdapter } from "./nyscef";

const adapters: Record<string, CourtAdapter> = {
  MANUAL: ManualAdapter,
  IMPORT: ICSImportAdapter,
  COURTLISTENER: CourtListenerAdapter,
  PACER: PACERAdapter,
  NYSCEF: NYSCEFAdapter,
};

export function getAdapter(provider: string): CourtAdapter {
  const adapter = adapters[provider.toUpperCase()];
  if (!adapter) throw new Error(`Unknown court adapter: ${provider}`);
  return adapter;
}

export function listAdapters(): Array<{ name: string; implemented: boolean; description: string }> {
  return [
    { name: "COURTLISTENER", implemented: true, description: "Free federal court dockets via CourtListener API" },
    { name: "IMPORT", implemented: true, description: "Import .ics calendar files from any court system" },
    { name: "MANUAL", implemented: true, description: "Manually enter court events" },
    { name: "PACER", implemented: false, description: "Federal court system (requires paid PACER account)" },
    { name: "NYSCEF", implemented: false, description: "New York State court e-filing (use ICS import for now)" },
  ];
}
