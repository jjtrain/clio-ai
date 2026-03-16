const QB_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QB_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QB_API_BASE = "https://quickbooks.api.intuit.com/v3/company";
const QB_SANDBOX_API = "https://sandbox-quickbooks.api.intuit.com/v3/company";

function getBaseUrl() {
  return process.env.NODE_ENV === "production" ? QB_API_BASE : QB_SANDBOX_API;
}

export function getQBAuthUrl(redirectUri: string): string {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  if (!clientId) throw new Error("QUICKBOOKS_CLIENT_ID not configured");
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: redirectUri,
    state: "qb_auth",
  });
  return `${QB_AUTH_URL}?${params.toString()}`;
}

export async function exchangeQBCode(code: string, realmId: string, redirectUri: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID!;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET!;
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(QB_TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[QB] Token exchange error:", text);
    throw new Error("Failed to exchange QuickBooks code");
  }

  const data = await res.json();
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in };
}

export async function refreshQBToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID!;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET!;
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(QB_TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });

  if (!res.ok) throw new Error("Failed to refresh QuickBooks token");
  const data = await res.json();
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in };
}

function qbHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}`, Accept: "application/json", "Content-Type": "application/json" };
}

export async function qbCreateCustomer(accessToken: string, realmId: string, client: { name: string; email?: string; phone?: string }) {
  const res = await fetch(`${getBaseUrl()}/${realmId}/customer`, {
    method: "POST", headers: qbHeaders(accessToken),
    body: JSON.stringify({ DisplayName: client.name, PrimaryEmailAddr: client.email ? { Address: client.email } : undefined, PrimaryPhone: client.phone ? { FreeFormNumber: client.phone } : undefined }),
  });
  const data = await res.json();
  return { id: data.Customer?.Id || data.id };
}

export async function qbCreateInvoice(accessToken: string, realmId: string, invoice: { customerRef: string; lineItems: Array<{ description: string; amount: number }>; dueDate: string; invoiceNumber: string }) {
  const lines = invoice.lineItems.map((li, i) => ({
    DetailType: "SalesItemLineDetail", Amount: li.amount, Description: li.description,
    SalesItemLineDetail: { ItemRef: { value: "1", name: "Services" } },
    LineNum: i + 1,
  }));
  const res = await fetch(`${getBaseUrl()}/${realmId}/invoice`, {
    method: "POST", headers: qbHeaders(accessToken),
    body: JSON.stringify({ CustomerRef: { value: invoice.customerRef }, Line: lines, DueDate: invoice.dueDate, DocNumber: invoice.invoiceNumber }),
  });
  const data = await res.json();
  return { id: data.Invoice?.Id || data.id };
}

export async function qbCreatePayment(accessToken: string, realmId: string, payment: { customerRef: string; amount: number; date: string }) {
  const res = await fetch(`${getBaseUrl()}/${realmId}/payment`, {
    method: "POST", headers: qbHeaders(accessToken),
    body: JSON.stringify({ CustomerRef: { value: payment.customerRef }, TotalAmt: payment.amount, TxnDate: payment.date }),
  });
  const data = await res.json();
  return { id: data.Payment?.Id || data.id };
}

export async function qbGetAccounts(accessToken: string, realmId: string) {
  const res = await fetch(`${getBaseUrl()}/${realmId}/query?query=${encodeURIComponent("select * from Account MAXRESULTS 200")}`, { headers: qbHeaders(accessToken) });
  const data = await res.json();
  return (data.QueryResponse?.Account || []).map((a: any) => ({ id: a.Id, name: a.Name, type: a.AccountType, balance: a.CurrentBalance }));
}

export async function qbGetCustomers(accessToken: string, realmId: string) {
  const res = await fetch(`${getBaseUrl()}/${realmId}/query?query=${encodeURIComponent("select * from Customer MAXRESULTS 200")}`, { headers: qbHeaders(accessToken) });
  const data = await res.json();
  return (data.QueryResponse?.Customer || []).map((c: any) => ({ id: c.Id, name: c.DisplayName, email: c.PrimaryEmailAddr?.Address }));
}
