const XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize";
const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_API_BASE = "https://api.xero.com/api.xro/2.0";

export function getXeroAuthUrl(redirectUri: string): string {
  const clientId = process.env.XERO_CLIENT_ID;
  if (!clientId) throw new Error("XERO_CLIENT_ID not configured");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "openid profile email accounting.transactions accounting.contacts accounting.settings offline_access",
    state: "xero_auth",
  });
  return `${XERO_AUTH_URL}?${params.toString()}`;
}

export async function exchangeXeroCode(code: string, redirectUri: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; tenantId: string }> {
  const clientId = process.env.XERO_CLIENT_ID!;
  const clientSecret = process.env.XERO_CLIENT_SECRET!;
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
  });

  if (!res.ok) throw new Error("Failed to exchange Xero code");
  const data = await res.json();

  // Get tenant ID
  const connRes = await fetch("https://api.xero.com/connections", {
    headers: { Authorization: `Bearer ${data.access_token}`, "Content-Type": "application/json" },
  });
  const connections = await connRes.json();
  const tenantId = connections[0]?.tenantId || "";

  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in, tenantId };
}

export async function refreshXeroToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const clientId = process.env.XERO_CLIENT_ID!;
  const clientSecret = process.env.XERO_CLIENT_SECRET!;
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });

  if (!res.ok) throw new Error("Failed to refresh Xero token");
  const data = await res.json();
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in };
}

function xeroHeaders(accessToken: string, tenantId: string) {
  return { Authorization: `Bearer ${accessToken}`, "Xero-tenant-id": tenantId, "Content-Type": "application/json" };
}

export async function xeroCreateContact(accessToken: string, tenantId: string, client: { name: string; email?: string; phone?: string }) {
  const res = await fetch(`${XERO_API_BASE}/Contacts`, {
    method: "POST", headers: xeroHeaders(accessToken, tenantId),
    body: JSON.stringify({ Contacts: [{ Name: client.name, EmailAddress: client.email, Phones: client.phone ? [{ PhoneType: "DEFAULT", PhoneNumber: client.phone }] : undefined }] }),
  });
  const data = await res.json();
  return { id: data.Contacts?.[0]?.ContactID || "" };
}

export async function xeroCreateInvoice(accessToken: string, tenantId: string, invoice: { contactId: string; lineItems: Array<{ description: string; amount: number }>; dueDate: string; invoiceNumber: string }) {
  const lines = invoice.lineItems.map((li) => ({ Description: li.description, Quantity: 1, UnitAmount: li.amount, AccountCode: "200" }));
  const res = await fetch(`${XERO_API_BASE}/Invoices`, {
    method: "POST", headers: xeroHeaders(accessToken, tenantId),
    body: JSON.stringify({ Invoices: [{ Type: "ACCREC", Contact: { ContactID: invoice.contactId }, LineItems: lines, DueDate: invoice.dueDate, InvoiceNumber: invoice.invoiceNumber, Status: "AUTHORISED" }] }),
  });
  const data = await res.json();
  return { id: data.Invoices?.[0]?.InvoiceID || "" };
}

export async function xeroCreatePayment(accessToken: string, tenantId: string, payment: { invoiceId: string; amount: number; date: string; accountId?: string }) {
  const res = await fetch(`${XERO_API_BASE}/Payments`, {
    method: "POST", headers: xeroHeaders(accessToken, tenantId),
    body: JSON.stringify({ Payments: [{ Invoice: { InvoiceID: payment.invoiceId }, Amount: payment.amount, Date: payment.date, Account: { AccountID: payment.accountId || "" } }] }),
  });
  const data = await res.json();
  return { id: data.Payments?.[0]?.PaymentID || "" };
}

export async function xeroGetAccounts(accessToken: string, tenantId: string) {
  const res = await fetch(`${XERO_API_BASE}/Accounts`, { headers: xeroHeaders(accessToken, tenantId) });
  const data = await res.json();
  return (data.Accounts || []).map((a: any) => ({ id: a.AccountID, name: a.Name, type: a.Type, code: a.Code }));
}

export async function xeroGetContacts(accessToken: string, tenantId: string) {
  const res = await fetch(`${XERO_API_BASE}/Contacts`, { headers: xeroHeaders(accessToken, tenantId) });
  const data = await res.json();
  return (data.Contacts || []).map((c: any) => ({ id: c.ContactID, name: c.Name, email: c.EmailAddress }));
}
