import type { ProviderAdapter, MigrationContact, MigrationMatter, MigrationDocument, MigrationInvoice } from "../types";

const BASE = "https://api.practicepanther.com/v1";
const RATE_LIMIT_MS = 250;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ppFetch(path: string, token: string) {
  await wait(RATE_LIMIT_MS);
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`PracticePanther API ${res.status}`);
  return res.json();
}

export const PracticePantherAdapter: ProviderAdapter = {
  name: "PRACTICEPANTHER",
  async authenticate(credentials) { return { accessToken: credentials.apiKey }; },
  async fetchContacts(token, opts) {
    const data = await ppFetch(`/contacts?limit=${opts?.limit || 200}`, token);
    return (data || []).map((c: any): MigrationContact => ({
      id: String(c.id), firstName: c.first_name || "", lastName: c.last_name || "",
      email: c.email, phone: c.phone, type: "client", createdAt: c.created_at,
    }));
  },
  async fetchMatters(token, opts) {
    const data = await ppFetch(`/matters?limit=${opts?.limit || 200}`, token);
    return (data || []).map((m: any): MigrationMatter => ({
      id: String(m.id), name: m.name || `Matter ${m.id}`, status: m.status || "Open",
      clientId: m.contact_id ? String(m.contact_id) : undefined, practiceArea: m.practice_area,
      openDate: m.open_date, closeDate: m.close_date,
    }));
  },
  async fetchDocuments(token, opts) {
    const data = await ppFetch(`/documents?limit=${opts?.limit || 200}`, token);
    return (data || []).map((d: any): MigrationDocument => ({
      id: String(d.id), matterId: d.matter_id ? String(d.matter_id) : undefined,
      name: d.name || "Untitled", mimeType: d.content_type, uploadedAt: d.created_at,
    }));
  },
  async fetchInvoices(token, opts) {
    const data = await ppFetch(`/invoices?limit=${opts?.limit || 200}`, token);
    return (data || []).map((i: any): MigrationInvoice => ({
      id: String(i.id), matterId: i.matter_id ? String(i.matter_id) : undefined,
      clientId: i.contact_id ? String(i.contact_id) : undefined,
      amount: i.total || 0, status: i.status === "paid" ? "paid" : i.status === "sent" ? "sent" : "draft",
      dueDate: i.due_date, issuedAt: i.invoice_date,
    }));
  },
};
