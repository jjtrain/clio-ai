import type { ProviderAdapter } from "../types";
import { ClioAdapter } from "./clio";
import { PracticePantherAdapter } from "./practicepanther";
import { MyCaseAdapter } from "./mycase";

const adapters: Record<string, ProviderAdapter> = { CLIO: ClioAdapter, PRACTICEPANTHER: PracticePantherAdapter, MYCASE: MyCaseAdapter };
export function getProviderAdapter(provider: string): ProviderAdapter { return adapters[provider.toUpperCase()] || adapters.CLIO; }
export const PROVIDERS = [
  { id: "CLIO", name: "Clio", auth: "oauth", description: "Import from Clio Manage (OAuth 2.0)" },
  { id: "PRACTICEPANTHER", name: "PracticePanther", auth: "apikey", description: "Import from PracticePanther (API Key)" },
  { id: "MYCASE", name: "MyCase", auth: "oauth", description: "Import from MyCase (OAuth 2.0)" },
];
