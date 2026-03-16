import { db } from "@/lib/db";

export async function getPaymentConfig() {
  const settings = await db.paymentSettings.findUnique({ where: { id: "default" } });
  if (!settings || !settings.isEnabled) return null;
  return settings;
}

export async function initializeCheckoutSession(params: {
  amount: number;
  currency?: string;
  customerEmail?: string;
  customerName?: string;
  invoiceNumber?: string;
  description?: string;
  acceptedMethods?: string[];
  returnUrl?: string;
  cancelUrl?: string;
}): Promise<{ sessionId: string; checkoutUrl: string; clientSecret?: string }> {
  const config = await getPaymentConfig();
  if (!config) throw new Error("Payments not configured");

  // Placeholder — in production integrate with Helcim/Stripe SDK
  return {
    sessionId: `session_${Date.now()}`,
    checkoutUrl: params.returnUrl || "/payments",
    clientSecret: undefined,
  };
}

export async function processPayment(params: {
  amount: number;
  method: string;
  token?: string;
  cardNumber?: string;
  expiry?: string;
  cvv?: string;
  bankAccount?: string;
  bankRouting?: string;
}): Promise<{ success: boolean; transactionId: string; processorResponse: any }> {
  const config = await getPaymentConfig();

  // Simulated processing — replace with real processor integration
  const transactionId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    success: true,
    transactionId,
    processorResponse: {
      id: transactionId,
      status: "approved",
      amount: params.amount,
      method: params.method,
      timestamp: new Date().toISOString(),
    },
  };
}

export async function refundPayment(
  transactionId: string,
  amount?: number
): Promise<{ success: boolean; refundId: string }> {
  return {
    success: true,
    refundId: `ref_${Date.now()}`,
  };
}

export async function getTransactionStatus(
  transactionId: string
): Promise<{ status: string; details: any }> {
  return { status: "completed", details: { id: transactionId } };
}

export function generatePaymentLink(baseUrl: string, token: string): string {
  return `${baseUrl}/pay/${token}`;
}
