import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

async function getConfig() {
  const s = await db.invoiceSherpaSettings.findUnique({ where: { id: "default" } });
  if (!s?.isEnabled || !s?.apiKey) return null;
  return { baseUrl: s.baseUrl || "https://api.invoicesherpa.com/v1", apiKey: s.apiKey };
}
function headers(apiKey: string) { return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }; }

export async function sherpaTestConnection() {
  const config = await getConfig();
  if (!config) return { success: false, error: "InvoiceSherpa is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/account`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `InvoiceSherpa returned ${res.status}` };
    const data = await res.json();
    return { success: true, accountName: data.name || data.account_name };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function sherpaSyncInvoice(params: { invoiceNumber: string; clientName: string; clientEmail: string; amount: number; dueDate: string }) {
  const config = await getConfig();
  if (!config) return { success: false, error: "InvoiceSherpa not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/invoices`, { method: "POST", headers: headers(config.apiKey), body: JSON.stringify({ invoice_number: params.invoiceNumber, client_name: params.clientName, client_email: params.clientEmail, amount: params.amount, due_date: params.dueDate }) });
    if (!res.ok) return { success: false, error: `Sync failed: ${res.status}` };
    const data = await res.json();
    return { success: true, data: { sherpaInvoiceId: data.id || `sh_${Date.now()}`, paymentLinkUrl: data.payment_link_url || data.payment_url, status: data.status || "synced" } };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function sherpaSendReminder(sherpaInvoiceId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "InvoiceSherpa not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/invoices/${sherpaInvoiceId}/remind`, { method: "POST", headers: headers(config.apiKey) });
    return { success: res.ok };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function sherpaGetStatus(sherpaInvoiceId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "InvoiceSherpa not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/invoices/${sherpaInvoiceId}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}
