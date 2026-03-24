/**
 * Xero adapter — OAuth 2.0 REST API
 *
 * Sandbox setup:
 *   1. Create app at https://developer.xero.com
 *   2. Get Client ID and Client Secret
 *   3. Set redirect URI to {APP_URL}/api/accounting/callback/XERO
 *   4. Use demo company for testing (free)
 *
 * Environment variables:
 *   XERO_CLIENT_ID, XERO_CLIENT_SECRET
 *
 * Mapping:
 *   Client → Xero Contact
 *   Invoice → Xero Invoice (ACCREC type)
 *   Payment → Xero Payment
 *   Match on externalAccountingId, fall back to email matching
 */

import type { AccountingAdapter, Credentials, PushResult, ExternalInvoice, ExternalPayment } from "./types";

const XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize";
const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_API_BASE = "https://api.xero.com/api.xro/2.0";
const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID || "";
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET || "";

async function xeroFetch(path: string, credentials: Credentials, options: RequestInit = {}): Promise<any> {
  const res = await fetch(`${XERO_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      "xero-tenant-id": credentials.tenantId || "",
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    throw new Error("XERO_TOKEN_EXPIRED");
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Xero API error ${res.status}: ${body.slice(0, 300)}`);
  }

  return res.json();
}

export const XeroAdapter: AccountingAdapter = {
  provider: "XERO",

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: XERO_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: "openid profile email accounting.transactions accounting.contacts offline_access",
      state,
    });
    return `${XERO_AUTH_URL}?${params.toString()}`;
  },

  async exchangeCode(code: string, redirectUri: string): Promise<Credentials> {
    const res = await fetch(XERO_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!res.ok) throw new Error(`Xero token exchange failed: ${await res.text()}`);
    const data = await res.json();

    // Get tenant ID from connections
    const connRes = await fetch("https://api.xero.com/connections", {
      headers: { Authorization: `Bearer ${data.access_token}`, "Content-Type": "application/json" },
    });
    const connections = await connRes.json();
    const tenantId = connections[0]?.tenantId;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tenantId,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  },

  async refreshTokens(credentials: Credentials): Promise<Credentials> {
    const res = await fetch(XERO_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: credentials.refreshToken,
      }),
    });

    if (!res.ok) throw new Error("Xero token refresh failed");
    const data = await res.json();

    return {
      ...credentials,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  },

  async pushClient(client, credentials, existingExternalId?): Promise<PushResult> {
    if (existingExternalId) {
      await xeroFetch("/Contacts", credentials, {
        method: "POST",
        body: JSON.stringify({
          Contacts: [{
            ContactID: existingExternalId,
            Name: client.name,
            EmailAddress: client.email || undefined,
            Phones: client.phone ? [{ PhoneType: "DEFAULT", PhoneNumber: client.phone }] : undefined,
          }],
        }),
      });
      return { externalId: existingExternalId, action: "updated" };
    }

    // Search by email
    if (client.email) {
      const searchResult = await xeroFetch(`/Contacts?where=EmailAddress=="${client.email}"`, credentials);
      if (searchResult.Contacts?.length > 0) {
        return { externalId: searchResult.Contacts[0].ContactID, action: "updated" };
      }
    }

    const result = await xeroFetch("/Contacts", credentials, {
      method: "POST",
      body: JSON.stringify({
        Contacts: [{
          Name: client.name,
          EmailAddress: client.email || undefined,
          Phones: client.phone ? [{ PhoneType: "DEFAULT", PhoneNumber: client.phone }] : undefined,
          Addresses: client.address ? [{ AddressType: "STREET", AddressLine1: client.address }] : undefined,
        }],
      }),
    });

    return { externalId: result.Contacts[0].ContactID, action: "created" };
  },

  async pushInvoice(invoice, clientExternalId, credentials, existingExternalId?): Promise<PushResult> {
    const lineItems = invoice.lineItems.map((item) => ({
      Description: item.description,
      Quantity: item.quantity,
      UnitAmount: item.amount,
      AccountCode: "200", // Default sales account
    }));

    const invoiceData: any = {
      Type: "ACCREC",
      Contact: { ContactID: clientExternalId },
      LineItems: lineItems,
      DueDate: invoice.dueDate.toISOString().split("T")[0],
      Date: invoice.issueDate.toISOString().split("T")[0],
      InvoiceNumber: invoice.invoiceNumber,
      Status: "AUTHORISED",
    };

    if (existingExternalId) {
      invoiceData.InvoiceID = existingExternalId;
    }

    const result = await xeroFetch("/Invoices", credentials, {
      method: "POST",
      body: JSON.stringify({ Invoices: [invoiceData] }),
    });

    return {
      externalId: result.Invoices[0].InvoiceID,
      action: existingExternalId ? "updated" : "created",
    };
  },

  async pushPayment(payment, invoiceExternalId, credentials, existingExternalId?): Promise<PushResult> {
    if (existingExternalId) {
      return { externalId: existingExternalId, action: "updated" };
    }

    const result = await xeroFetch("/Payments", credentials, {
      method: "PUT",
      body: JSON.stringify({
        Invoice: { InvoiceID: invoiceExternalId },
        Account: { Code: "090" }, // Default bank account
        Amount: payment.amount,
        Date: payment.paymentDate.toISOString().split("T")[0],
        Reference: payment.reference,
      }),
    });

    return { externalId: result.Payments[0].PaymentID, action: "created" };
  },

  async pullInvoices(since: Date, credentials): Promise<ExternalInvoice[]> {
    const dateStr = since.toISOString();
    const result = await xeroFetch(`/Invoices?where=UpdatedDateUTC>DateTime(${since.getFullYear()},${since.getMonth() + 1},${since.getDate()})&Statuses=AUTHORISED,PAID`, credentials);

    return (result.Invoices || []).map((inv: any) => ({
      externalId: inv.InvoiceID,
      invoiceNumber: inv.InvoiceNumber,
      customerRef: inv.Contact?.ContactID,
      total: Number(inv.Total),
      amountPaid: Number(inv.AmountPaid),
      status: inv.Status === "PAID" ? "PAID" : "OPEN",
      dueDate: inv.DueDateString ? new Date(inv.DueDateString) : undefined,
      paidAt: inv.FullyPaidOnDate ? new Date(inv.FullyPaidOnDate) : undefined,
    }));
  },

  async pullPayments(since: Date, credentials): Promise<ExternalPayment[]> {
    const result = await xeroFetch(`/Payments?where=UpdatedDateUTC>DateTime(${since.getFullYear()},${since.getMonth() + 1},${since.getDate()})`, credentials);

    return (result.Payments || []).map((pmt: any) => ({
      externalId: pmt.PaymentID,
      invoiceRef: pmt.Invoice?.InvoiceID || "",
      amount: Number(pmt.Amount),
      paymentDate: new Date(pmt.Date),
    }));
  },
};
