/**
 * FreshBooks adapter — stub for future implementation.
 * Will use FreshBooks OAuth 2.0 API.
 */
import type { AccountingAdapter, Credentials, PushResult, ExternalInvoice, ExternalPayment } from "./types";

const NOT_IMPLEMENTED = "FreshBooks integration is not yet implemented. Coming soon.";

export const FreshBooksAdapter: AccountingAdapter = {
  provider: "FRESHBOOKS",

  getAuthUrl(): string { throw new Error(NOT_IMPLEMENTED); },
  async exchangeCode(): Promise<Credentials> { throw new Error(NOT_IMPLEMENTED); },
  async refreshTokens(c: Credentials): Promise<Credentials> { throw new Error(NOT_IMPLEMENTED); },
  async pushClient(): Promise<PushResult> { throw new Error(NOT_IMPLEMENTED); },
  async pushInvoice(): Promise<PushResult> { throw new Error(NOT_IMPLEMENTED); },
  async pushPayment(): Promise<PushResult> { throw new Error(NOT_IMPLEMENTED); },
  async pullInvoices(): Promise<ExternalInvoice[]> { throw new Error(NOT_IMPLEMENTED); },
  async pullPayments(): Promise<ExternalPayment[]> { throw new Error(NOT_IMPLEMENTED); },
};
