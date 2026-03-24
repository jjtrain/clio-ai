/**
 * QuickBooks Online adapter — OAuth 2.0 REST API
 *
 * Sandbox setup:
 *   1. Create app at https://developer.intuit.com
 *   2. Get Client ID and Client Secret
 *   3. Set redirect URI to {APP_URL}/api/accounting/callback/QUICKBOOKS
 *   4. Use sandbox company for testing (free)
 *
 * Environment variables:
 *   QBO_CLIENT_ID, QBO_CLIENT_SECRET
 *
 * Mapping:
 *   Client → QBO Customer (match on email, create if not exists)
 *   Invoice → QBO Invoice (line items, due date, terms)
 *   Payment → QBO Payment (linked to QBO Invoice)
 *   Trust deposit → QBO receive payment to trust liability account
 *   Conflict resolution: our app wins for invoice amounts, QBO wins for payment status
 */

import type { AccountingAdapter, Credentials, PushResult, ExternalInvoice, ExternalPayment } from "./types";

const QBO_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QBO_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QBO_API_BASE = process.env.QBO_SANDBOX === "true"
  ? "https://sandbox-quickbooks.api.intuit.com"
  : "https://quickbooks.api.intuit.com";
const QBO_CLIENT_ID = process.env.QBO_CLIENT_ID || "";
const QBO_CLIENT_SECRET = process.env.QBO_CLIENT_SECRET || "";

async function qboFetch(path: string, credentials: Credentials, options: RequestInit = {}): Promise<any> {
  const url = `${QBO_API_BASE}/v3/company/${credentials.realmId}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    throw new Error("QBO_TOKEN_EXPIRED");
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`QBO API error ${res.status}: ${body.slice(0, 300)}`);
  }

  return res.json();
}

export const QuickBooksAdapter: AccountingAdapter = {
  provider: "QUICKBOOKS",

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: QBO_CLIENT_ID,
      scope: "com.intuit.quickbooks.accounting",
      redirect_uri: redirectUri,
      response_type: "code",
      state,
    });
    return `${QBO_AUTH_URL}?${params.toString()}`;
  },

  async exchangeCode(code: string, redirectUri: string): Promise<Credentials> {
    const res = await fetch(QBO_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`QBO token exchange failed: ${body}`);
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  },

  async refreshTokens(credentials: Credentials): Promise<Credentials> {
    const res = await fetch(QBO_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: credentials.refreshToken,
      }),
    });

    if (!res.ok) {
      throw new Error("QBO token refresh failed");
    }

    const data = await res.json();
    return {
      ...credentials,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  },

  async pushClient(client, credentials, existingExternalId?): Promise<PushResult> {
    // Check if customer exists by email or existing ID
    if (existingExternalId) {
      const existing = await qboFetch(`/customer/${existingExternalId}?minorversion=65`, credentials);
      await qboFetch(`/customer?minorversion=65`, credentials, {
        method: "POST",
        body: JSON.stringify({
          Id: existingExternalId,
          SyncToken: existing.Customer.SyncToken,
          DisplayName: client.name,
          PrimaryEmailAddr: client.email ? { Address: client.email } : undefined,
          PrimaryPhone: client.phone ? { FreeFormNumber: client.phone } : undefined,
        }),
      });
      return { externalId: existingExternalId, action: "updated" };
    }

    // Search by email first
    if (client.email) {
      const query = encodeURIComponent(`select * from Customer where PrimaryEmailAddr = '${client.email}'`);
      const searchResult = await qboFetch(`/query?query=${query}&minorversion=65`, credentials);
      if (searchResult.QueryResponse?.Customer?.length > 0) {
        return { externalId: searchResult.QueryResponse.Customer[0].Id, action: "updated" };
      }
    }

    // Create new customer
    const result = await qboFetch(`/customer?minorversion=65`, credentials, {
      method: "POST",
      body: JSON.stringify({
        DisplayName: client.name,
        PrimaryEmailAddr: client.email ? { Address: client.email } : undefined,
        PrimaryPhone: client.phone ? { FreeFormNumber: client.phone } : undefined,
        BillAddr: client.address ? { Line1: client.address } : undefined,
      }),
    });

    return { externalId: result.Customer.Id, action: "created" };
  },

  async pushInvoice(invoice, clientExternalId, credentials, existingExternalId?): Promise<PushResult> {
    const lines = invoice.lineItems.map((item, i) => ({
      LineNum: i + 1,
      Amount: item.amount * item.quantity,
      DetailType: "SalesItemLineDetail",
      Description: item.description,
      SalesItemLineDetail: {
        Qty: item.quantity,
        UnitPrice: item.amount,
      },
    }));

    if (existingExternalId) {
      const existing = await qboFetch(`/invoice/${existingExternalId}?minorversion=65`, credentials);
      // Our app wins for invoice amounts
      const result = await qboFetch(`/invoice?minorversion=65`, credentials, {
        method: "POST",
        body: JSON.stringify({
          Id: existingExternalId,
          SyncToken: existing.Invoice.SyncToken,
          CustomerRef: { value: clientExternalId },
          Line: lines,
          DueDate: invoice.dueDate.toISOString().split("T")[0],
          TxnDate: invoice.issueDate.toISOString().split("T")[0],
          DocNumber: invoice.invoiceNumber,
        }),
      });
      return { externalId: result.Invoice.Id, action: "updated" };
    }

    const result = await qboFetch(`/invoice?minorversion=65`, credentials, {
      method: "POST",
      body: JSON.stringify({
        CustomerRef: { value: clientExternalId },
        Line: lines,
        DueDate: invoice.dueDate.toISOString().split("T")[0],
        TxnDate: invoice.issueDate.toISOString().split("T")[0],
        DocNumber: invoice.invoiceNumber,
      }),
    });

    return { externalId: result.Invoice.Id, action: "created" };
  },

  async pushPayment(payment, invoiceExternalId, credentials, existingExternalId?): Promise<PushResult> {
    if (existingExternalId) {
      return { externalId: existingExternalId, action: "updated" };
    }

    const result = await qboFetch(`/payment?minorversion=65`, credentials, {
      method: "POST",
      body: JSON.stringify({
        TotalAmt: payment.amount,
        TxnDate: payment.paymentDate.toISOString().split("T")[0],
        Line: [{
          Amount: payment.amount,
          LinkedTxn: [{ TxnId: invoiceExternalId, TxnType: "Invoice" }],
        }],
        PaymentRefNum: payment.reference,
      }),
    });

    return { externalId: result.Payment.Id, action: "created" };
  },

  async pullInvoices(since: Date, credentials): Promise<ExternalInvoice[]> {
    const dateStr = since.toISOString().split("T")[0];
    const query = encodeURIComponent(`select * from Invoice where MetaData.LastUpdatedTime > '${dateStr}' MAXRESULTS 100`);
    const result = await qboFetch(`/query?query=${query}&minorversion=65`, credentials);

    return (result.QueryResponse?.Invoice || []).map((inv: any) => ({
      externalId: inv.Id,
      invoiceNumber: inv.DocNumber,
      customerRef: inv.CustomerRef?.value,
      total: Number(inv.TotalAmt),
      amountPaid: Number(inv.TotalAmt) - Number(inv.Balance || 0),
      status: inv.Balance === 0 ? "PAID" : "OPEN",
      dueDate: inv.DueDate ? new Date(inv.DueDate) : undefined,
      paidAt: inv.Balance === 0 ? new Date(inv.MetaData?.LastUpdatedTime) : undefined,
    }));
  },

  async pullPayments(since: Date, credentials): Promise<ExternalPayment[]> {
    const dateStr = since.toISOString().split("T")[0];
    const query = encodeURIComponent(`select * from Payment where MetaData.LastUpdatedTime > '${dateStr}' MAXRESULTS 100`);
    const result = await qboFetch(`/query?query=${query}&minorversion=65`, credentials);

    return (result.QueryResponse?.Payment || []).map((pmt: any) => ({
      externalId: pmt.Id,
      invoiceRef: pmt.Line?.[0]?.LinkedTxn?.[0]?.TxnId || "",
      amount: Number(pmt.TotalAmt),
      paymentDate: new Date(pmt.TxnDate),
      method: pmt.PaymentMethodRef?.name,
    }));
  },
};
