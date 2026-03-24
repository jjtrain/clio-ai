// Email sending via Resend API
// Requires RESEND_API_KEY environment variable

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_API_URL = "https://api.resend.com/emails";

interface EmailOptions {
  to: string;
  from: string;
  subject: string;
  html: string;
}

async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.warn("[Email] RESEND_API_KEY not configured, skipping email send");
    return { success: false, error: "Email not configured" };
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: options.from,
        to: [options.to],
        subject: options.subject,
        html: options.html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[Email] Failed to send:", body);
      return { success: false, error: body };
    }

    return { success: true };
  } catch (err: any) {
    console.error("[Email] Error:", err.message);
    return { success: false, error: err.message };
  }
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface AppointmentEmailData {
  clientName: string;
  clientEmail: string;
  startTime: Date;
  endTime: Date;
  practiceArea?: string | null;
  firmName?: string;
  fromEmail: string;
}

export async function sendAppointmentConfirmation(data: AppointmentEmailData) {
  return sendEmail({
    to: data.clientEmail,
    from: data.fromEmail,
    subject: `Appointment Confirmed - ${formatDateTime(data.startTime)}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Appointment Confirmed</h2>
        <p>Hello ${data.clientName},</p>
        <p>Your consultation has been confirmed.</p>
        <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Date & Time:</strong> ${formatDateTime(data.startTime)}</p>
          <p style="margin: 4px 0;"><strong>Duration:</strong> ${Math.round((data.endTime.getTime() - data.startTime.getTime()) / 60000)} minutes</p>
          ${data.practiceArea ? `<p style="margin: 4px 0;"><strong>Practice Area:</strong> ${data.practiceArea}</p>` : ""}
        </div>
        <p>If you need to cancel or reschedule, please contact our office.</p>
        <p style="color: #666; font-size: 14px;">${data.firmName || "Our Law Firm"}</p>
      </div>
    `,
  });
}

export async function sendAppointmentReminder(data: AppointmentEmailData) {
  return sendEmail({
    to: data.clientEmail,
    from: data.fromEmail,
    subject: `Reminder: Upcoming Appointment - ${formatDateTime(data.startTime)}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Appointment Reminder</h2>
        <p>Hello ${data.clientName},</p>
        <p>This is a friendly reminder about your upcoming consultation.</p>
        <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Date & Time:</strong> ${formatDateTime(data.startTime)}</p>
          <p style="margin: 4px 0;"><strong>Duration:</strong> ${Math.round((data.endTime.getTime() - data.startTime.getTime()) / 60000)} minutes</p>
          ${data.practiceArea ? `<p style="margin: 4px 0;"><strong>Practice Area:</strong> ${data.practiceArea}</p>` : ""}
        </div>
        <p>If you need to cancel or reschedule, please contact our office as soon as possible.</p>
        <p style="color: #666; font-size: 14px;">${data.firmName || "Our Law Firm"}</p>
      </div>
    `,
  });
}

// ─── Signature Emails ───────────────────────────────────────────────

interface SignatureEmailData {
  to: string;
  clientName: string;
  title: string;
  firmName: string;
  fromEmail: string;
}

export async function sendSignatureRequest(
  data: SignatureEmailData & { signingUrl: string }
) {
  return sendEmail({
    to: data.to,
    from: data.fromEmail,
    subject: `Please sign: ${data.title}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Document Ready for Signature</h2>
        <p>Hello ${data.clientName},</p>
        <p>${data.firmName} has sent you a document to review and sign electronically.</p>
        <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Document:</strong> ${data.title}</p>
        </div>
        <p>Please click the button below to review and sign the document:</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${data.signingUrl}" style="display: inline-block; background: #3B82F6; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Review & Sign Document
          </a>
        </div>
        <p style="color: #666; font-size: 13px;">If the button doesn't work, copy and paste this link: ${data.signingUrl}</p>
        <p style="color: #666; font-size: 14px;">${data.firmName}</p>
      </div>
    `,
  });
}

export async function sendSignatureCompleteNotification(data: SignatureEmailData) {
  return sendEmail({
    to: data.to,
    from: data.fromEmail,
    subject: `Client signed: ${data.title}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Client Has Signed</h2>
        <p>${data.clientName} has signed the following document:</p>
        <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Document:</strong> ${data.title}</p>
          <p style="margin: 4px 0;"><strong>Client:</strong> ${data.clientName}</p>
        </div>
        <p>Please log in to review and countersign the document.</p>
        <p style="color: #666; font-size: 14px;">${data.firmName}</p>
      </div>
    `,
  });
}

export async function sendSignatureFullyComplete(data: SignatureEmailData) {
  return sendEmail({
    to: data.to,
    from: data.fromEmail,
    subject: `Fully executed: ${data.title}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Document Fully Executed</h2>
        <p>Hello ${data.clientName},</p>
        <p>All parties have signed the following document:</p>
        <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Document:</strong> ${data.title}</p>
        </div>
        <p>The document is now fully executed. Please contact our office if you have any questions.</p>
        <p style="color: #666; font-size: 14px;">${data.firmName}</p>
      </div>
    `,
  });
}

// ─── Campaign Emails ──────────────────────────────────────────────

export async function sendCampaignEmail(options: {
  to: string;
  name: string;
  subject: string;
  htmlContent: string;
  fromEmail: string;
  firmName?: string;
}) {
  const html = options.htmlContent
    .replace(/\{NAME\}/g, options.name || "there")
    .replace(/\{EMAIL\}/g, options.to)
    .replace(/\{FIRM_NAME\}/g, options.firmName || "Our Law Firm");

  const subject = options.subject
    .replace(/\{NAME\}/g, options.name || "there")
    .replace(/\{FIRM_NAME\}/g, options.firmName || "Our Law Firm");

  return sendEmail({
    to: options.to,
    from: options.fromEmail,
    subject,
    html,
  });
}

// ─── Invoice Emails ───────────────────────────────────────────────

interface SendInvoiceEmailData {
  to: string;
  clientName: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  firmName: string;
  fromEmail: string;
  invoiceHtml: string;
  viewUrl?: string;
}

export async function sendInvoiceEmail(data: SendInvoiceEmailData) {
  return sendEmail({
    to: data.to,
    from: data.fromEmail,
    subject: `Invoice ${data.invoiceNumber} from ${data.firmName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Invoice ${data.invoiceNumber}</h2>
        <p>Hello ${data.clientName},</p>
        <p>Please find your invoice from ${data.firmName} below.</p>
        <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Invoice:</strong> ${data.invoiceNumber}</p>
          <p style="margin: 4px 0;"><strong>Amount Due:</strong> ${data.amount}</p>
          <p style="margin: 4px 0;"><strong>Due Date:</strong> ${data.dueDate}</p>
        </div>
        ${data.viewUrl ? `
        <div style="text-align: center; margin: 24px 0;">
          <a href="${data.viewUrl}" style="display: inline-block; background: #3B82F6; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            View & Pay Invoice
          </a>
        </div>
        ` : ""}
        <p>Please include the invoice number with your payment.</p>
        <p style="color: #666; font-size: 14px;">${data.firmName}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        ${data.invoiceHtml}
      </div>
    `,
  });
}

// ─── Payment Emails ──────────────────────────────────────────────

export async function sendPaymentLinkEmail(params: {
  to: string;
  name: string;
  amount: number;
  paymentUrl: string;
  title: string;
  firmName: string;
  fromEmail: string;
}) {
  const amountStr = "$" + params.amount.toLocaleString("en-US", { minimumFractionDigits: 2 });
  return sendEmail({
    to: params.to,
    from: params.fromEmail,
    subject: `Payment Request: ${params.title} - ${amountStr}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Payment Request</h2>
        <p>Hello ${params.name},</p>
        <p>${params.firmName} has sent you a payment request.</p>
        <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Description:</strong> ${params.title}</p>
          <p style="margin: 4px 0; font-size: 24px; font-weight: bold; color: #1E40AF;">${amountStr}</p>
        </div>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${params.paymentUrl}" style="display: inline-block; background: #3B82F6; color: white; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Pay Now
          </a>
        </div>
        <p style="color: #666; font-size: 13px;">If the button doesn't work, copy and paste this link: ${params.paymentUrl}</p>
        <p style="color: #666; font-size: 12px;">This payment is securely processed. Your payment information is encrypted.</p>
        <p style="color: #666; font-size: 14px;">${params.firmName}</p>
      </div>
    `,
  });
}

export async function sendPaymentReceipt(params: {
  to: string;
  name: string;
  amount: number;
  method: string;
  last4?: string;
  transactionId: string;
  firmName: string;
  fromEmail: string;
}) {
  const amountStr = "$" + params.amount.toLocaleString("en-US", { minimumFractionDigits: 2 });
  const methodDisplay = params.method.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return sendEmail({
    to: params.to,
    from: params.fromEmail,
    subject: `Payment Receipt - ${amountStr} - ${params.firmName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">Payment Successful</h2>
        <p>Hello ${params.name},</p>
        <p>Your payment has been received. Thank you!</p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Amount:</strong> ${amountStr}</p>
          <p style="margin: 4px 0;"><strong>Method:</strong> ${methodDisplay}${params.last4 ? ` ending in ${params.last4}` : ""}</p>
          <p style="margin: 4px 0;"><strong>Transaction ID:</strong> ${params.transactionId}</p>
          <p style="margin: 4px 0;"><strong>Date:</strong> ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        <p>Please keep this email for your records.</p>
        <p style="color: #666; font-size: 14px;">${params.firmName}</p>
      </div>
    `,
  });
}

// ─── Interest & Discount Emails ──────────────────────────────────

export async function sendInterestNotice(params: {
  to: string; clientName: string; invoiceNumber: string; interestAmount: number;
  totalNowDue: number; daysLate: number; firmName: string; fromEmail: string; paymentLink?: string;
}) {
  const amt = "$" + params.interestAmount.toFixed(2);
  const total = "$" + params.totalNowDue.toFixed(2);
  return sendEmail({
    to: params.to, from: params.fromEmail,
    subject: `Interest Applied — Invoice ${params.invoiceNumber}`,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#1a1a1a;">Interest Applied to Your Account</h2>
      <p>Hello ${params.clientName},</p>
      <p>Invoice <strong>${params.invoiceNumber}</strong> is <strong>${params.daysLate} days</strong> past due. An interest charge of <strong>${amt}</strong> has been applied.</p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:4px 0;"><strong>Interest Charge:</strong> ${amt}</p>
        <p style="margin:4px 0;"><strong>Total Now Due:</strong> ${total}</p>
      </div>
      ${params.paymentLink ? `<div style="text-align:center;margin:24px 0;"><a href="${params.paymentLink}" style="display:inline-block;background:#3B82F6;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Pay Now</a></div>` : ""}
      <p>Please remit payment promptly to avoid additional charges.</p>
      <p style="color:#666;font-size:14px;">${params.firmName}</p></div>`,
  });
}

export async function sendEarlyPaymentReminder(params: {
  to: string; clientName: string; invoiceNumber: string; discountAmount: number;
  discountPercentage: number; deadline: string; firmName: string; fromEmail: string; paymentLink?: string;
}) {
  const disc = "$" + params.discountAmount.toFixed(2);
  return sendEmail({
    to: params.to, from: params.fromEmail,
    subject: `Save ${params.discountPercentage}% — Pay Invoice ${params.invoiceNumber} Early`,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#16a34a;">Save ${disc} with Early Payment!</h2>
      <p>Hello ${params.clientName},</p>
      <p>Pay invoice <strong>${params.invoiceNumber}</strong> by <strong>${params.deadline}</strong> and receive a <strong>${params.discountPercentage}%</strong> discount (${disc}).</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:4px 0;"><strong>Discount:</strong> ${disc} (${params.discountPercentage}%)</p>
        <p style="margin:4px 0;"><strong>Pay By:</strong> ${params.deadline}</p>
      </div>
      ${params.paymentLink ? `<div style="text-align:center;margin:24px 0;"><a href="${params.paymentLink}" style="display:inline-block;background:#16a34a;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Pay Now & Save</a></div>` : ""}
      <p style="color:#666;font-size:14px;">${params.firmName}</p></div>`,
  });
}

export async function sendDiscountApplied(params: {
  to: string; clientName: string; invoiceNumber: string; discountAmount: number; firmName: string; fromEmail: string;
}) {
  const disc = "$" + params.discountAmount.toFixed(2);
  return sendEmail({
    to: params.to, from: params.fromEmail,
    subject: `Early Payment Discount Applied — Invoice ${params.invoiceNumber}`,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#16a34a;">Discount Applied!</h2>
      <p>Hello ${params.clientName},</p>
      <p>Thank you for your prompt payment! A discount of <strong>${disc}</strong> has been applied to invoice <strong>${params.invoiceNumber}</strong>.</p>
      <p style="color:#666;font-size:14px;">${params.firmName}</p></div>`,
  });
}

// ─── Approval Emails ─────────────────────────────────────────────

export async function sendApprovalRequest(params: {
  to: string; approverName: string; invoiceNumber: string; amount: number; clientName: string;
  submitterName: string; approvalUrl: string; firmName: string; fromEmail: string;
}) {
  const amt = "$" + params.amount.toLocaleString("en-US", { minimumFractionDigits: 2 });
  return sendEmail({
    to: params.to, from: params.fromEmail,
    subject: `Approval Needed: Invoice ${params.invoiceNumber} (${amt})`,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#1a1a1a;">Invoice Needs Your Approval</h2>
      <p>Hello ${params.approverName},</p>
      <p>${params.submitterName} has submitted invoice <strong>${params.invoiceNumber}</strong> for your approval.</p>
      <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:4px 0;"><strong>Invoice:</strong> ${params.invoiceNumber}</p>
        <p style="margin:4px 0;font-size:24px;font-weight:bold;">${amt}</p>
        <p style="margin:4px 0;"><strong>Client:</strong> ${params.clientName}</p>
      </div>
      <div style="text-align:center;margin:24px 0;">
        <a href="${params.approvalUrl}" style="display:inline-block;background:#3B82F6;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Review & Approve</a>
      </div>
      <p style="color:#666;font-size:14px;">${params.firmName}</p></div>`,
  });
}

export async function sendApprovalResult(params: {
  to: string; submitterName: string; invoiceNumber: string; amount: number; status: string;
  approverName: string; comment?: string; firmName: string; fromEmail: string;
}) {
  const amt = "$" + params.amount.toLocaleString("en-US", { minimumFractionDigits: 2 });
  const approved = params.status === "APPROVED" || params.status === "AUTO_APPROVED";
  return sendEmail({
    to: params.to, from: params.fromEmail,
    subject: `Invoice ${params.invoiceNumber} ${approved ? "Approved" : "Rejected"}`,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:${approved ? "#16a34a" : "#dc2626"};">Invoice ${approved ? "Approved" : "Rejected"}</h2>
      <p>Hello ${params.submitterName},</p>
      <p>Invoice <strong>${params.invoiceNumber}</strong> (${amt}) has been <strong>${params.status.toLowerCase().replace("_", "-")}</strong> by ${params.approverName}.</p>
      ${params.comment ? `<div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:16px 0;"><p style="margin:4px 0;"><strong>Comment:</strong> ${params.comment}</p></div>` : ""}
      <p style="color:#666;font-size:14px;">${params.firmName}</p></div>`,
  });
}

export async function sendEscalationNotice(params: {
  to: string; name: string; invoiceNumber: string; amount: number; daysWaiting: number;
  firmName: string; fromEmail: string;
}) {
  const amt = "$" + params.amount.toLocaleString("en-US", { minimumFractionDigits: 2 });
  return sendEmail({
    to: params.to, from: params.fromEmail,
    subject: `Escalation: Invoice ${params.invoiceNumber} Approval Overdue (${params.daysWaiting} days)`,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#d97706;">Approval Escalation</h2>
      <p>Hello ${params.name},</p>
      <p>Invoice <strong>${params.invoiceNumber}</strong> (${amt}) has been waiting for approval for <strong>${params.daysWaiting} days</strong> and requires attention.</p>
      <p style="color:#666;font-size:14px;">${params.firmName}</p></div>`,
  });
}

// ─── Daily Digest Email ──────────────────────────────────────────

export async function sendDigestEmail(params: {
  to: string;
  subject: string;
  html: string;
  fromEmail: string;
}): Promise<{ success: boolean; error?: string; previewHtml?: string }> {
  if (!RESEND_API_KEY) {
    console.log("[Email] RESEND_API_KEY not configured — saving digest preview");
    return { success: true, previewHtml: params.html };
  }
  const result = await sendEmail({
    to: params.to,
    from: params.fromEmail,
    subject: params.subject,
    html: params.html,
  });
  return result;
}

export async function sendAppointmentCancellation(data: AppointmentEmailData & { reason?: string }) {
  return sendEmail({
    to: data.clientEmail,
    from: data.fromEmail,
    subject: `Appointment Cancelled - ${formatDateTime(data.startTime)}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Appointment Cancelled</h2>
        <p>Hello ${data.clientName},</p>
        <p>Your appointment has been cancelled.</p>
        <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Original Date:</strong> ${formatDateTime(data.startTime)}</p>
          ${data.reason ? `<p style="margin: 4px 0;"><strong>Reason:</strong> ${data.reason}</p>` : ""}
        </div>
        <p>If you would like to reschedule, please visit our booking page or contact our office.</p>
        <p style="color: #666; font-size: 14px;">${data.firmName || "Our Law Firm"}</p>
      </div>
    `,
  });
}
