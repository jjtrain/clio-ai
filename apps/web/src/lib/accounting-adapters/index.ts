export type { AccountingAdapter, Credentials, PushResult, ExternalInvoice, ExternalPayment } from "./types";
export { QuickBooksAdapter } from "./quickbooks";
export { XeroAdapter } from "./xero";
export { FreshBooksAdapter } from "./freshbooks";

import type { AccountingAdapter } from "./types";
import { QuickBooksAdapter } from "./quickbooks";
import { XeroAdapter } from "./xero";
import { FreshBooksAdapter } from "./freshbooks";

const adapters: Record<string, AccountingAdapter> = {
  QUICKBOOKS: QuickBooksAdapter,
  XERO: XeroAdapter,
  FRESHBOOKS: FreshBooksAdapter,
};

export function getAccountingAdapter(provider: string): AccountingAdapter {
  const adapter = adapters[provider.toUpperCase()];
  if (!adapter) throw new Error(`Unknown accounting provider: ${provider}`);
  return adapter;
}
