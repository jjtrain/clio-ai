// Twilio SMS Integration Helper
import { db } from "./db";

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  defaultSignature?: string;
  requireConsent: boolean;
  consentMessage?: string;
  autoReplyEnabled: boolean;
  autoReplyMessage?: string;
  autoReplyOutsideHours: boolean;
  businessHours?: string;
}

export async function getTwilioConfig(): Promise<TwilioConfig | null> {
  const settings = await db.textMessageSettings.findUnique({ where: { id: "default" } });
  if (!settings?.isEnabled || !settings?.twilioAccountSid || !settings?.twilioAuthToken || !settings?.twilioPhoneNumber) {
    return null;
  }
  return {
    accountSid: settings.twilioAccountSid,
    authToken: settings.twilioAuthToken,
    phoneNumber: settings.twilioPhoneNumber,
    defaultSignature: settings.defaultSignature || undefined,
    requireConsent: settings.requireConsent,
    consentMessage: settings.consentMessage || undefined,
    autoReplyEnabled: settings.autoReplyEnabled,
    autoReplyMessage: settings.autoReplyMessage || undefined,
    autoReplyOutsideHours: settings.autoReplyOutsideHours,
    businessHours: settings.businessHours || undefined,
  };
}

export async function sendSms(
  config: TwilioConfig,
  to: string,
  body: string,
  mediaUrl?: string,
  statusCallback?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");
    const params = new URLSearchParams();
    params.append("From", config.phoneNumber);
    params.append("To", to);
    params.append("Body", body);
    if (mediaUrl) params.append("MediaUrl", mediaUrl);
    if (statusCallback) params.append("StatusCallback", statusCallback);

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    const data = await response.json();
    if (!response.ok || data.code) {
      return { success: false, error: data.message || `Twilio error: ${response.status}` };
    }

    return { success: true, messageId: data.sid };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function formatPhoneNumber(phone: string): string {
  // Strip everything except digits and leading +
  let cleaned = phone.replace(/[^\d+]/g, "");

  // If starts with +, keep it
  if (cleaned.startsWith("+")) return cleaned;

  // Remove leading 1 for US numbers if 11 digits
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+${cleaned}`;
  }

  // If 10 digits, assume US and add +1
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  // Otherwise just prepend + if not present
  return `+${cleaned}`;
}

export function validatePhoneNumber(phone: string): boolean {
  const formatted = formatPhoneNumber(phone);
  // E.164: + followed by 1-15 digits
  return /^\+[1-9]\d{1,14}$/.test(formatted);
}

export async function getMessageStatus(
  config: TwilioConfig,
  messageSid: string
): Promise<{ status: string; errorCode?: number; errorMessage?: string }> {
  const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages/${messageSid}.json`,
    {
      headers: { Authorization: `Basic ${auth}` },
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Twilio error: ${response.status}`);
  }

  return {
    status: data.status,
    errorCode: data.error_code || undefined,
    errorMessage: data.error_message || undefined,
  };
}

export function isOutsideBusinessHours(businessHoursJson?: string): boolean {
  if (!businessHoursJson) return false;
  try {
    const hours = JSON.parse(businessHoursJson);
    const now = new Date();
    const day = now.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    const dayHours = hours[day];
    if (!dayHours || !dayHours.enabled) return true;

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = (dayHours.start || "09:00").split(":").map(Number);
    const [endH, endM] = (dayHours.end || "17:00").split(":").map(Number);
    const start = startH * 60 + startM;
    const end = endH * 60 + endM;

    return currentMinutes < start || currentMinutes > end;
  } catch {
    return false;
  }
}

export async function testTwilioConnection(
  accountSid: string,
  authToken: string
): Promise<{ connected: boolean; phoneNumber?: string; error?: string }> {
  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
      {
        headers: { Authorization: `Basic ${auth}` },
      }
    );
    const data = await response.json();
    if (!response.ok) {
      return { connected: false, error: data.message || `HTTP ${response.status}` };
    }
    return { connected: true, phoneNumber: data.friendly_name };
  } catch (err: any) {
    return { connected: false, error: err.message };
  }
}
