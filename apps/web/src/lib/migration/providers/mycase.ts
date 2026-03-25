import type { ProviderAdapter, MigrationContact, MigrationMatter, MigrationDocument, MigrationInvoice } from "../types";

const BASE = "https://api.mycase.com/v1";
const RATE_LIMIT_MS = 200;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function mcFetch(path: string, token: string) {
  await wait(RATE_LIMIT_MS);
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`MyCase API ${res.status}`);
  return res.json();
}

export const MyCaseAdapter: ProviderAdapter = {
  name: "MYCASE",
  async authenticate(credentials) {
    const res = await fetch("https://auth.mycase.com/oauth/token", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: "authorization_code", code: credentials.code, client_id: credentials.clientId, client_secret: credentials.clientSecret, redirect_uri: credentials.redirectUri }),
    });
    if (!res.ok) throw new Error("MyCase auth failed");
    const data = await res.json();
    return { accessToken: data.access_token, refreshToken: data.refresh_token };
  },
  async fetchContacts(token, opts) {
    const data = await mcFetch(`/contacts?per_page=${opts?.limit || 200}`, token);
    return (data.contacts || data || []).map((c: any): MigrationContact => ({
      id: String(c.id), firstName: c.first_name || "", lastName: c.last_name || "",
      email: c.email, phone: c.phone, type: "client", createdAt: c.created_at,
    }));
  },
  async fetchMatters(token, opts) {
    const data = await mcFetch(`/cases?per_page=${opts?.limit || 200}`, token);
    return (data.cases || data || []).map((m: any): MigrationMatter => ({
      id: String(m.id), name: m.name || `Case ${m.id}`, status: m.status || "Open",
      clientId: m.client_id ? String(m.client_id) : undefined, practiceArea: m.practice_area,
      openDate: m.open_date, closeDate: m.close_date,
    }));
  },
  async fetchDocuments(token, opts) {
    const data = await mcFetch(`/documents?per_page=${opts?.limit || 200}`, token);
    return (data.documents || data || []).map((d: any): MigrationDocument => ({
      id: String(d.id), matterId: d.case_id ? String(d.case_id) : undefined,
      name: d.name || "Untitled", mimeType: d.content_type, uploadedAt: d.created_at,
    }));
  },
  async fetchInvoices(token, opts) {
    const data = await mcFetch(`/invoices?per_page=${opts?.limit || 200}`, token);
    return (data.invoices || data || []).map((i: any): MigrationInvoice => ({
      id: String(i.id), matterId: i.case_id ? String(i.case_id) : undefined,
      amount: i.total || 0, status: i.status === "paid" ? "paid" : i.status === "sent" ? "sent" : "draft",
      dueDate: i.due_date, issuedAt: i.issue_date,
    }));
  },
};
