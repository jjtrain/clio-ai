// HelloSign (Dropbox Sign) API Integration
// API Docs: https://developers.hellosign.com/api/reference/

const HELLOSIGN_API_URL = "https://api.hellosign.com/v3";

interface HelloSignConfig {
  apiKey: string;
  clientId?: string;
  testMode?: boolean;
}

interface SignerInfo {
  name: string;
  emailAddress: string;
  order?: number;
}

interface CreateSignatureRequestParams {
  title: string;
  subject?: string;
  message?: string;
  signers: SignerInfo[];
  fileContent?: string; // HTML content to convert
  fileUrl?: string;
  testMode?: boolean;
  clientId?: string;
  metadata?: Record<string, string>;
  callbackUrl?: string;
  useEmbeddedSigning?: boolean;
}

interface HelloSignResponse {
  signature_request?: {
    signature_request_id: string;
    title: string;
    signing_url?: string;
    details_url?: string;
    is_complete: boolean;
    has_error: boolean;
    signatures: Array<{
      signature_id: string;
      signer_email_address: string;
      signer_name: string;
      status_code: string;
      signed_at?: number;
    }>;
    files_url?: string;
  };
  error?: {
    error_msg: string;
    error_name: string;
  };
}

function getAuthHeader(apiKey: string): string {
  return "Basic " + Buffer.from(apiKey + ":").toString("base64");
}

export async function createSignatureRequest(
  config: HelloSignConfig,
  params: CreateSignatureRequestParams
): Promise<HelloSignResponse> {
  const formData = new FormData();
  formData.append("title", params.title);
  if (params.subject) formData.append("subject", params.subject);
  if (params.message) formData.append("message", params.message);
  formData.append("test_mode", (params.testMode ?? config.testMode ?? true) ? "1" : "0");
  if (params.clientId || config.clientId) {
    formData.append("client_id", (params.clientId || config.clientId)!);
  }
  if (params.callbackUrl) {
    formData.append("signing_redirect_url", params.callbackUrl);
  }

  // Add signers
  params.signers.forEach((signer, i) => {
    formData.append(`signers[${i}][name]`, signer.name);
    formData.append(`signers[${i}][email_address]`, signer.emailAddress);
    if (signer.order !== undefined) {
      formData.append(`signers[${i}][order]`, signer.order.toString());
    }
  });

  // Add metadata
  if (params.metadata) {
    Object.entries(params.metadata).forEach(([key, value]) => {
      formData.append(`metadata[${key}]`, value);
    });
  }

  // If we have HTML content, convert it to a file
  if (params.fileContent) {
    const htmlBlob = new Blob([params.fileContent], { type: "text/html" });
    formData.append("file[0]", htmlBlob, "document.html");
  } else if (params.fileUrl) {
    formData.append("file_url[0]", params.fileUrl);
  }

  // Use embedded endpoint if client ID is available and embedded signing requested
  const endpoint = params.useEmbeddedSigning && (params.clientId || config.clientId)
    ? `${HELLOSIGN_API_URL}/signature_request/create_embedded`
    : `${HELLOSIGN_API_URL}/signature_request/send`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(config.apiKey),
    },
    body: formData,
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    console.error("[HelloSign] API error:", data.error || response.status);
    throw new Error(data.error?.error_msg || `HelloSign API error: ${response.status}`);
  }

  return data;
}

export async function getSignatureRequest(
  config: HelloSignConfig,
  signatureRequestId: string
): Promise<HelloSignResponse> {
  const response = await fetch(
    `${HELLOSIGN_API_URL}/signature_request/${signatureRequestId}`,
    {
      headers: { Authorization: getAuthHeader(config.apiKey) },
    }
  );

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error?.error_msg || `HelloSign API error: ${response.status}`);
  }
  return data;
}

export async function cancelSignatureRequest(
  config: HelloSignConfig,
  signatureRequestId: string
): Promise<void> {
  const response = await fetch(
    `${HELLOSIGN_API_URL}/signature_request/cancel/${signatureRequestId}`,
    {
      method: "POST",
      headers: { Authorization: getAuthHeader(config.apiKey) },
    }
  );

  if (!response.ok && response.status !== 200) {
    const data = await response.json().catch(() => ({}));
    throw new Error((data as any).error?.error_msg || `HelloSign cancel error: ${response.status}`);
  }
}

export async function sendReminder(
  config: HelloSignConfig,
  signatureRequestId: string,
  emailAddress: string
): Promise<void> {
  const response = await fetch(
    `${HELLOSIGN_API_URL}/signature_request/remind/${signatureRequestId}`,
    {
      method: "POST",
      headers: {
        Authorization: getAuthHeader(config.apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email_address: emailAddress }),
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error((data as any).error?.error_msg || `HelloSign reminder error: ${response.status}`);
  }
}

export async function getFileUrl(
  config: HelloSignConfig,
  signatureRequestId: string
): Promise<string> {
  const response = await fetch(
    `${HELLOSIGN_API_URL}/signature_request/files/${signatureRequestId}?get_url=1`,
    {
      headers: { Authorization: getAuthHeader(config.apiKey) },
    }
  );

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error?.error_msg || `HelloSign files error: ${response.status}`);
  }
  return data.file_url;
}

export async function getEmbeddedSignUrl(
  config: HelloSignConfig,
  signatureId: string
): Promise<{ sign_url: string; expires_at: number }> {
  const response = await fetch(
    `${HELLOSIGN_API_URL}/embedded/sign_url/${signatureId}`,
    {
      headers: { Authorization: getAuthHeader(config.apiKey) },
    }
  );

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error?.error_msg || `HelloSign embedded URL error: ${response.status}`);
  }
  return data.embedded;
}

export async function testConnection(apiKey: string): Promise<{ success: boolean; account?: any; error?: string }> {
  try {
    const response = await fetch(`${HELLOSIGN_API_URL}/account`, {
      headers: { Authorization: getAuthHeader(apiKey) },
    });
    const data = await response.json();
    if (!response.ok || data.error) {
      return { success: false, error: data.error?.error_msg || `HTTP ${response.status}` };
    }
    return { success: true, account: data.account };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Parse HelloSign webhook event
export interface HelloSignEvent {
  event: {
    event_type: string;
    event_time: string;
    event_hash: string;
    event_metadata: {
      related_signature_id?: string;
      reported_for_account_id?: string;
      reported_for_app_id?: string;
    };
  };
  signature_request?: HelloSignResponse["signature_request"];
  account?: any;
}

export function verifyWebhookHash(eventHash: string, apiKey: string, eventTime: string, eventType: string): boolean {
  const crypto = require("crypto");
  const expectedHash = crypto
    .createHmac("sha256", apiKey)
    .update(eventTime + eventType)
    .digest("hex");
  return expectedHash === eventHash;
}

export function computeEventHash(apiKey: string, eventTime: string, eventType: string): string {
  const crypto = require("crypto");
  return crypto
    .createHmac("sha256", apiKey)
    .update(eventTime + eventType)
    .digest("hex");
}

export function mapHelloSignStatus(statusCode: string): string {
  switch (statusCode) {
    case "awaiting_signature": return "PENDING_CLIENT";
    case "signed": return "CLIENT_SIGNED";
    case "declined": return "CANCELLED";
    default: return statusCode;
  }
}
