// ─── Shared types for all accounting adapters ───────────────────

export interface Credentials {
  accessToken: string;
  refreshToken: string;
  realmId?: string;    // QuickBooks
  tenantId?: string;   // Xero
  expiresAt?: Date;
}

export interface ExternalInvoice {
  externalId: string;
  invoiceNumber?: string;
  customerRef?: string;
  total: number;
  amountPaid: number;
  status: string;
  dueDate?: Date;
  paidAt?: Date;
}

export interface ExternalPayment {
  externalId: string;
  invoiceRef: string;
  amount: number;
  paymentDate: Date;
  method?: string;
}

export interface PushResult {
  externalId: string;
  action: "created" | "updated";
}

export interface AccountingAdapter {
  provider: string;
  getAuthUrl(redirectUri: string, state: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<Credentials>;
  refreshTokens(credentials: Credentials): Promise<Credentials>;
  pushClient(client: { id: string; name: string; email?: string | null; phone?: string | null; address?: string | null }, credentials: Credentials, existingExternalId?: string): Promise<PushResult>;
  pushInvoice(invoice: { id: string; invoiceNumber: string; total: number; dueDate: Date; issueDate: Date; lineItems: Array<{ description: string; amount: number; quantity: number }> }, clientExternalId: string, credentials: Credentials, existingExternalId?: string): Promise<PushResult>;
  pushPayment(payment: { id: string; amount: number; paymentDate: Date; paymentMethod?: string; reference?: string }, invoiceExternalId: string, credentials: Credentials, existingExternalId?: string): Promise<PushResult>;
  pullInvoices(since: Date, credentials: Credentials): Promise<ExternalInvoice[]>;
  pullPayments(since: Date, credentials: Credentials): Promise<ExternalPayment[]>;
}
