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
