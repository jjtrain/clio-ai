import type { ProviderAdapter, MigrationContact, MigrationMatter, MigrationDocument, MigrationInvoice } from "../types";

const BASE = "https://app.clio.com/api/v4";
const RATE_LIMIT_MS = 200; // 5 req/sec
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function clioFetch(path: string, token: string) {
  await wait(RATE_LIMIT_MS);
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
  if (!res.ok) throw new Error(`Clio API ${res.status}: ${await res.text()}`);
  return res.json();
}

export const ClioAdapter: ProviderAdapter = {
  name: "CLIO",

  async authenticate(credentials) {
    // OAuth 2.0 code exchange
    const res = await fetch("https://app.clio.com/oauth/token", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: "authorization_code", code: credentials.code, client_id: credentials.clientId, client_secret: credentials.clientSecret, redirect_uri: credentials.redirectUri }),
    });
    if (!res.ok) throw new Error("Clio auth failed");
    const data = await res.json();
    return { accessToken: data.access_token, refreshToken: data.refresh_token };
  },

  async fetchContacts(token, opts) {
    const data = await clioFetch(`/contacts.json?limit=${opts?.limit || 200}&fields=id,first_name,last_name,email_addresses,phone_numbers,type,created_at`, token);
    return (data.data || []).map((c: any): MigrationContact => ({
      id: String(c.id), firstName: c.first_name || "", lastName: c.last_name || "",
      email: c.email_addresses?.[0]?.address, phone: c.phone_numbers?.[0]?.number,
      type: c.type === "Person" ? "client" : "lead", createdAt: c.created_at,
    }));
  },

  async fetchMatters(token, opts) {
    const data = await clioFetch(`/matters.json?limit=${opts?.limit || 200}&fields=id,display_number,description,status,client,practice_area,open_date,close_date`, token);
    return (data.data || []).map((m: any): MigrationMatter => ({
      id: String(m.id), name: m.display_number || m.description || `Matter ${m.id}`,
      status: m.status || "Open", clientId: m.client?.id ? String(m.client.id) : undefined,
      practiceArea: m.practice_area?.name, openDate: m.open_date, closeDate: m.close_date,
    }));
  },

  async fetchDocuments(token, opts) {
    const data = await clioFetch(`/documents.json?limit=${opts?.limit || 200}&fields=id,name,content_type,matter,created_at`, token);
    return (data.data || []).map((d: any): MigrationDocument => ({
      id: String(d.id), matterId: d.matter?.id ? String(d.matter.id) : undefined,
      name: d.name || "Untitled", mimeType: d.content_type, uploadedAt: d.created_at,
    }));
  },

  async fetchInvoices(token, opts) {
    const data = await clioFetch(`/bills.json?limit=${opts?.limit || 200}&fields=id,matter,total,state,due_at,issued_at`, token);
    return (data.data || []).map((b: any): MigrationInvoice => ({
      id: String(b.id), matterId: b.matter?.id ? String(b.matter.id) : undefined,
      amount: b.total || 0, status: b.state === "paid" ? "paid" : b.state === "sent" ? "sent" : "draft",
      dueDate: b.due_at, issuedAt: b.issued_at,
    }));
  },
};
