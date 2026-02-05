import crypto from "crypto";

// In-memory store for secret tokens, keyed by invoiceId
// Each entry expires after 30 minutes
const secretTokenStore = new Map<
  string,
  { secretToken: string; expiresAt: number }
>();

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

function cleanExpiredTokens() {
  const now = Date.now();
  secretTokenStore.forEach((entry, key) => {
    if (entry.expiresAt <= now) {
      secretTokenStore.delete(key);
    }
  });
}

export async function getHelcimCredentials(
  db: any
): Promise<{ apiToken: string; accountId: string } | null> {
  // Try Settings table first
  try {
    const settings = await db.settings.findUnique({ where: { id: "default" } });
    if (settings?.helcimApiToken && settings?.helcimAccountId) {
      return {
        apiToken: settings.helcimApiToken,
        accountId: settings.helcimAccountId,
      };
    }
  } catch {
    // Settings table may not exist yet
  }

  // Fall back to env vars
  const apiToken = process.env.HELCIM_API_TOKEN;
  const accountId = process.env.HELCIM_ACCOUNT_ID;
  if (apiToken && accountId) {
    return { apiToken, accountId };
  }

  return null;
}

export async function initializeCheckout({
  amount,
  invoiceNumber,
  invoiceId,
  apiToken,
}: {
  amount: number;
  invoiceNumber: string;
  invoiceId: string;
  apiToken: string;
}): Promise<{ checkoutToken: string }> {
  // Helcim requires numeric-only invoice numbers (no hyphens or special chars)
  // Extract just the numeric portion from "INV-1001" -> "1001"
  const numericInvoiceNumber = invoiceNumber.replace(/[^0-9]/g, "");

  console.log("[Helcim] Initializing checkout:", {
    amount: amount.toFixed(2),
    originalInvoiceNumber: invoiceNumber,
    numericInvoiceNumber,
  });

  const response = await fetch("https://api.helcim.com/v2/helcim-pay/initialize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-token": apiToken,
      Accept: "application/json",
    },
    body: JSON.stringify({
      paymentType: "purchase",
      amount: amount.toFixed(2),
      currency: "USD",
      invoiceNumber: numericInvoiceNumber,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Helcim API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const { checkoutToken, secretToken } = data;

  if (!checkoutToken || !secretToken) {
    throw new Error("Helcim API returned incomplete response");
  }

  // Store secretToken for later hash verification
  cleanExpiredTokens();
  secretTokenStore.set(invoiceId, {
    secretToken,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });

  return { checkoutToken };
}

export function verifyTransactionResponse(
  invoiceId: string,
  responseHash: string,
  rawResponse: string
): boolean {
  cleanExpiredTokens();

  const entry = secretTokenStore.get(invoiceId);
  if (!entry) {
    throw new Error("No pending checkout found for this invoice (may have expired)");
  }

  const { secretToken } = entry;

  // Helcim hash verification: SHA-256 of raw response + secretToken
  const computedHash = crypto
    .createHash("sha256")
    .update(rawResponse + secretToken)
    .digest("hex");

  const isValid = computedHash === responseHash;

  if (isValid) {
    // Remove used token
    secretTokenStore.delete(invoiceId);
  }

  return isValid;
}
