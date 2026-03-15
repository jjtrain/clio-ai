// Invoice HTML renderer for branded, customizable invoice templates

interface Branding {
  logoUrl?: string;
  firmName: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
  website?: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  showLogo: boolean;
}

interface Layout {
  headerStyle: "centered" | "left" | "split";
  showMatterDetails: boolean;
  showTimeEntryDetails: boolean;
  showExpenseDetails: boolean;
  showPaymentHistory: boolean;
  showTrustBalance: boolean;
  showRemittanceSlip: boolean;
  groupTimeBy: "date" | "timekeeper" | "task" | "none";
  showHourlyBreakdown: boolean;
  showTotalHours: boolean;
  termsAndConditions?: string;
  paymentInstructions?: string;
  footerText?: string;
  customFields?: Array<{ label: string; value: string }>;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderInvoiceHtml(
  invoice: any,
  template: any,
  firmSettings?: any
): string {
  const branding: Branding = template?.branding
    ? (typeof template.branding === "string" ? JSON.parse(template.branding) : template.branding)
    : getDefaultBranding(firmSettings);
  const layout: Layout = template?.layout
    ? (typeof template.layout === "string" ? JSON.parse(template.layout) : template.layout)
    : getDefaultLayout();
  const format = template?.format || "SUMMARY";

  const primaryColor = branding.primaryColor || "#1E40AF";
  const accentColor = branding.accentColor || "#3B82F6";
  const fontFamily = branding.fontFamily || "Inter";

  const client = invoice.matter?.client || {};
  const balance = parseFloat(invoice.total?.toString() || "0") - parseFloat(invoice.amountPaid?.toString() || "0");
  const isOverdue = invoice.status === "OVERDUE";

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Invoice ${escapeHtml(invoice.invoiceNumber || "")}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: '${fontFamily}', Arial, sans-serif; color: #1f2937; line-height: 1.5; background: #fff; }
  .invoice-container { max-width: 800px; margin: 0 auto; padding: 40px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 10px 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
  td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
  tr:nth-child(even) { background: #f9fafb; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .font-bold { font-weight: 700; }
  .font-medium { font-weight: 500; }
  .text-sm { font-size: 12px; }
  .text-muted { color: #6b7280; }
  .mt-2 { margin-top: 8px; }
  .mt-4 { margin-top: 16px; }
  .mt-6 { margin-top: 24px; }
  .mb-4 { margin-bottom: 16px; }
  .mb-6 { margin-bottom: 24px; }
  .primary { color: ${primaryColor}; }
  .accent-bg { background: ${accentColor}10; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
  .badge-paid { background: #d1fae5; color: #065f46; }
  .badge-overdue { background: #fee2e2; color: #991b1b; }
  .badge-sent { background: #dbeafe; color: #1e40af; }
  .badge-draft { background: #f3f4f6; color: #4b5563; }
  .amount-due-box { background: ${primaryColor}; color: white; padding: 16px 24px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
  .section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 12px; }
  .divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .invoice-container { padding: 0; max-width: none; }
  }
  ${template?.cssOverrides || ""}
</style>
</head>
<body>
<div class="invoice-container">`;

  // HEADER
  if (template?.headerHtml && format === "CUSTOM") {
    html += template.headerHtml;
  } else {
    html += renderHeader(branding, layout, invoice, isOverdue);
  }

  // CLIENT INFO
  html += renderClientInfo(client, invoice, layout);

  // INVOICE DETAILS BAR
  html += renderDetailsBar(invoice, balance, primaryColor);

  // LINE ITEMS
  html += renderLineItems(invoice, format, layout);

  // TOTALS
  html += renderTotals(invoice, balance);

  // PAYMENT HISTORY
  if (layout.showPaymentHistory && invoice.payments?.length > 0) {
    html += renderPaymentHistory(invoice.payments);
  }

  // FOOTER
  if (template?.footerHtml && format === "CUSTOM") {
    html += template.footerHtml;
  } else {
    html += renderFooter(layout, branding, isOverdue);
  }

  // REMITTANCE SLIP
  if (layout.showRemittanceSlip) {
    html += renderRemittanceSlip(invoice, client, branding, balance);
  }

  html += `</div></body></html>`;
  return html;
}

function getDefaultBranding(firmSettings?: any): Branding {
  return {
    firmName: firmSettings?.firmName || "Your Law Firm",
    address: firmSettings?.address || "",
    phone: firmSettings?.phone || "",
    email: firmSettings?.email || "",
    primaryColor: "#1E40AF",
    accentColor: "#3B82F6",
    fontFamily: "Inter",
    showLogo: true,
  };
}

function getDefaultLayout(): Layout {
  return {
    headerStyle: "split",
    showMatterDetails: true,
    showTimeEntryDetails: true,
    showExpenseDetails: true,
    showPaymentHistory: true,
    showTrustBalance: false,
    showRemittanceSlip: false,
    groupTimeBy: "none",
    showHourlyBreakdown: true,
    showTotalHours: true,
    termsAndConditions: "Payment is due within 30 days of invoice date.",
    paymentInstructions: "Please include invoice number with your payment.",
  };
}

function renderHeader(branding: Branding, layout: Layout, invoice: any, isOverdue: boolean): string {
  const style = layout.headerStyle;
  const firmAddress = [branding.address, [branding.city, branding.state, branding.zip].filter(Boolean).join(", ")].filter(Boolean).join("<br/>");

  if (style === "centered") {
    return `<div class="text-center mb-6">
      ${branding.showLogo && branding.logoUrl ? `<img src="${branding.logoUrl}" alt="Logo" style="max-height:60px;margin:0 auto 12px;" />` : ""}
      <h1 style="font-size:24px;color:${branding.primaryColor};font-weight:700;">${escapeHtml(branding.firmName)}</h1>
      ${firmAddress ? `<p class="text-sm text-muted mt-2">${firmAddress}</p>` : ""}
      ${branding.phone ? `<p class="text-sm text-muted">${escapeHtml(branding.phone)}</p>` : ""}
      ${branding.email ? `<p class="text-sm text-muted">${escapeHtml(branding.email)}</p>` : ""}
      <h2 style="font-size:28px;color:#9ca3af;margin-top:20px;letter-spacing:4px;">INVOICE</h2>
    </div>`;
  }

  if (style === "left") {
    return `<div style="display:flex;justify-content:space-between;align-items:flex-start;" class="mb-6">
      <div>
        ${branding.showLogo && branding.logoUrl ? `<img src="${branding.logoUrl}" alt="Logo" style="max-height:50px;margin-bottom:8px;" />` : ""}
        <h1 style="font-size:22px;color:${branding.primaryColor};font-weight:700;">${escapeHtml(branding.firmName)}</h1>
        ${firmAddress ? `<p class="text-sm text-muted mt-2">${firmAddress}</p>` : ""}
        ${branding.phone ? `<p class="text-sm text-muted">${escapeHtml(branding.phone)}</p>` : ""}
      </div>
      <h2 style="font-size:32px;color:#d1d5db;font-weight:700;letter-spacing:3px;">INVOICE</h2>
    </div>`;
  }

  // split (default)
  return `<div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:24px;border-bottom:2px solid ${branding.primaryColor};" class="mb-6">
    <div>
      ${branding.showLogo && branding.logoUrl ? `<img src="${branding.logoUrl}" alt="Logo" style="max-height:50px;margin-bottom:8px;" />` : ""}
      <h1 style="font-size:22px;color:${branding.primaryColor};font-weight:700;">${escapeHtml(branding.firmName)}</h1>
      ${firmAddress ? `<p class="text-sm text-muted mt-2">${firmAddress}</p>` : ""}
      ${branding.phone ? `<p class="text-sm text-muted">${escapeHtml(branding.phone)}</p>` : ""}
      ${branding.email ? `<p class="text-sm text-muted">${escapeHtml(branding.email)}</p>` : ""}
    </div>
    <div class="text-right">
      <h2 style="font-size:28px;color:${branding.primaryColor};font-weight:700;">INVOICE</h2>
      <p class="mt-2"><strong>#${escapeHtml(invoice.invoiceNumber || "")}</strong></p>
      <p class="text-sm text-muted">Date: ${formatDate(invoice.issueDate)}</p>
      <p class="text-sm text-muted">Due: ${formatDate(invoice.dueDate)}</p>
      ${isOverdue ? `<span class="badge badge-overdue mt-2">OVERDUE</span>` : ""}
    </div>
  </div>`;
}

function renderClientInfo(client: any, invoice: any, layout: Layout): string {
  return `<div style="display:flex;gap:40px;" class="mb-6">
    <div style="flex:1;">
      <p class="section-title">Bill To</p>
      <p class="font-bold" style="font-size:16px;">${escapeHtml(client.name || "")}</p>
      ${client.address ? `<p class="text-sm text-muted">${escapeHtml(client.address)}</p>` : ""}
      ${client.email ? `<p class="text-sm text-muted">${escapeHtml(client.email)}</p>` : ""}
      ${client.phone ? `<p class="text-sm text-muted">${escapeHtml(client.phone)}</p>` : ""}
    </div>
    ${layout.showMatterDetails ? `<div style="flex:1;">
      <p class="section-title">Matter</p>
      <p class="font-medium">${escapeHtml(invoice.matter?.name || "")}</p>
      <p class="text-sm text-muted">${escapeHtml(invoice.matter?.matterNumber || "")}</p>
      ${invoice.matter?.practiceArea ? `<p class="text-sm text-muted">${escapeHtml(invoice.matter.practiceArea)}</p>` : ""}
    </div>` : ""}
  </div>`;
}

function renderDetailsBar(invoice: any, balance: number, primaryColor: string): string {
  return `<div class="amount-due-box mb-6">
    <div>
      <p style="font-size:12px;opacity:0.8;">Amount Due</p>
      <p style="font-size:24px;font-weight:700;">${formatCurrency(balance)}</p>
    </div>
    <div class="text-right">
      <p style="font-size:12px;opacity:0.8;">Status</p>
      <p style="font-size:16px;font-weight:600;">${invoice.status}</p>
    </div>
  </div>`;
}

function renderLineItems(invoice: any, format: string, layout: Layout): string {
  const items = invoice.lineItems || [];
  if (items.length === 0) return "";

  let html = `<div class="mb-6"><p class="section-title">Services</p>`;

  if (format === "FLAT_FEE") {
    html += `<table><thead><tr><th>Description</th><th class="text-right">Amount</th></tr></thead><tbody>`;
    for (const item of items) {
      html += `<tr><td>${escapeHtml(item.description)}</td><td class="text-right font-medium">${formatCurrency(Number(item.amount))}</td></tr>`;
    }
    html += `</tbody></table>`;
  } else if (format === "SUMMARY") {
    html += `<table><thead><tr><th>Description</th><th class="text-right" style="width:80px;">Qty</th><th class="text-right" style="width:100px;">Rate</th><th class="text-right" style="width:110px;">Amount</th></tr></thead><tbody>`;
    for (const item of items) {
      html += `<tr><td>${escapeHtml(item.description)}${item.date ? `<br/><span class="text-sm text-muted">${formatDate(item.date)}</span>` : ""}</td><td class="text-right">${Number(item.quantity).toFixed(2)}</td><td class="text-right">${formatCurrency(Number(item.rate))}</td><td class="text-right font-medium">${formatCurrency(Number(item.amount))}</td></tr>`;
    }
    html += `</tbody></table>`;
  } else {
    // DETAILED / TIMEKEEPER / CUSTOM
    html += `<table><thead><tr><th>Date</th><th>Description</th><th class="text-right" style="width:70px;">Hours</th><th class="text-right" style="width:90px;">Rate</th><th class="text-right" style="width:100px;">Amount</th></tr></thead><tbody>`;
    for (const item of items) {
      html += `<tr><td class="text-sm">${item.date ? formatDate(item.date) : ""}</td><td>${escapeHtml(item.description)}</td><td class="text-right">${Number(item.quantity).toFixed(2)}</td><td class="text-right">${formatCurrency(Number(item.rate))}</td><td class="text-right font-medium">${formatCurrency(Number(item.amount))}</td></tr>`;
    }
    html += `</tbody></table>`;

    if (layout.showTotalHours) {
      const totalHours = items.reduce((sum: number, i: any) => sum + Number(i.quantity), 0);
      html += `<p class="text-sm text-muted mt-2" style="text-align:right;">Total Hours: ${totalHours.toFixed(2)}</p>`;
    }
  }

  html += `</div>`;
  return html;
}

function renderTotals(invoice: any, balance: number): string {
  const taxRate = parseFloat(invoice.taxRate?.toString() || "0");
  return `<div style="display:flex;justify-content:flex-end;" class="mb-6">
    <div style="width:280px;">
      <div style="display:flex;justify-content:space-between;padding:8px 0;"><span class="text-muted">Subtotal</span><span class="font-medium">${formatCurrency(Number(invoice.subtotal))}</span></div>
      ${taxRate > 0 ? `<div style="display:flex;justify-content:space-between;padding:8px 0;"><span class="text-muted">Tax (${taxRate}%)</span><span class="font-medium">${formatCurrency(Number(invoice.taxAmount))}</span></div>` : ""}
      <div style="display:flex;justify-content:space-between;padding:12px 0;border-top:2px solid #111827;font-size:18px;"><span class="font-bold">Total</span><span class="font-bold">${formatCurrency(Number(invoice.total))}</span></div>
      ${Number(invoice.amountPaid) > 0 ? `
        <div style="display:flex;justify-content:space-between;padding:8px 0;color:#059669;"><span>Paid</span><span class="font-medium">-${formatCurrency(Number(invoice.amountPaid))}</span></div>
        <div style="display:flex;justify-content:space-between;padding:12px 16px;background:#eff6ff;border-radius:8px;"><span class="font-bold" style="color:#1e40af;">Balance Due</span><span class="font-bold" style="color:#1e40af;">${formatCurrency(balance)}</span></div>
      ` : ""}
    </div>
  </div>`;
}

function renderPaymentHistory(payments: any[]): string {
  let html = `<hr class="divider" /><div class="mb-6"><p class="section-title">Payment History</p><table><thead><tr><th>Date</th><th>Method</th><th class="text-right">Amount</th><th>Reference</th></tr></thead><tbody>`;
  for (const p of payments) {
    html += `<tr><td>${formatDate(p.paymentDate)}</td><td>${(p.paymentMethod || "").replace(/_/g, " ")}</td><td class="text-right font-medium">${formatCurrency(Number(p.amount))}</td><td class="text-sm text-muted">${escapeHtml(p.reference || "-")}</td></tr>`;
  }
  html += `</tbody></table></div>`;
  return html;
}

function renderFooter(layout: Layout, branding: Branding, isOverdue: boolean): string {
  let html = `<hr class="divider" />`;

  if (layout.termsAndConditions) {
    html += `<div class="mb-4"><p class="section-title">Terms & Conditions</p><p class="text-sm text-muted">${escapeHtml(layout.termsAndConditions)}</p></div>`;
  }

  if (layout.paymentInstructions) {
    html += `<div class="mb-4"><p class="section-title">Payment Instructions</p><p class="text-sm text-muted">${escapeHtml(layout.paymentInstructions)}</p></div>`;
  }

  if (layout.customFields && layout.customFields.length > 0) {
    for (const f of layout.customFields) {
      html += `<p class="text-sm"><strong>${escapeHtml(f.label)}:</strong> ${escapeHtml(f.value)}</p>`;
    }
  }

  if (isOverdue) {
    html += `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-top:16px;"><p style="color:#991b1b;font-size:13px;font-weight:600;">This invoice is past due. Please remit payment immediately to avoid additional charges.</p></div>`;
  }

  html += `<div class="text-center mt-6 text-sm text-muted">${layout.footerText || "Thank you for your business."}</div>`;
  return html;
}

function renderRemittanceSlip(invoice: any, client: any, branding: Branding, balance: number): string {
  return `<hr style="border:none;border-top:2px dashed #d1d5db;margin:32px 0;" />
  <div style="padding:16px;background:#f9fafb;border-radius:8px;">
    <p class="font-bold" style="font-size:14px;">REMITTANCE SLIP</p>
    <div style="display:flex;justify-content:space-between;margin-top:12px;">
      <div><p class="text-sm">Invoice: <strong>#${escapeHtml(invoice.invoiceNumber || "")}</strong></p><p class="text-sm">Client: ${escapeHtml(client.name || "")}</p></div>
      <div class="text-right"><p class="text-sm">Amount Due:</p><p class="font-bold" style="font-size:18px;">${formatCurrency(balance)}</p></div>
    </div>
    <p class="text-sm text-muted mt-2">Make payable to: ${escapeHtml(branding.firmName)}</p>
  </div>`;
}

export function getSampleInvoice() {
  return {
    invoiceNumber: "INV-2026-001",
    status: "SENT",
    issueDate: new Date(),
    dueDate: new Date(Date.now() + 30 * 86400000),
    subtotal: "4500.00",
    taxRate: "0",
    taxAmount: "0",
    total: "4500.00",
    amountPaid: "1000.00",
    notes: "Thank you for your continued trust in our services.",
    matter: {
      name: "Smith v. Jones",
      matterNumber: "MAT-2026-042",
      practiceArea: "Civil Litigation",
      client: { name: "John Smith", email: "john@example.com", phone: "(555) 123-4567", address: "123 Main St, Suite 100, New York, NY 10001" },
    },
    lineItems: [
      { description: "Legal research — motion to dismiss", quantity: "3.50", rate: "450.00", amount: "1575.00", date: new Date(Date.now() - 5 * 86400000) },
      { description: "Draft memorandum of law", quantity: "4.00", rate: "450.00", amount: "1800.00", date: new Date(Date.now() - 3 * 86400000) },
      { description: "Court appearance — status conference", quantity: "2.50", rate: "450.00", amount: "1125.00", date: new Date(Date.now() - 1 * 86400000) },
    ],
    payments: [
      { paymentDate: new Date(Date.now() - 10 * 86400000), paymentMethod: "BANK_TRANSFER", amount: "1000.00", reference: "CHK-4521" },
    ],
  };
}
