import { db } from "@/lib/db";
import { getAccountingAdapter } from "./accounting-adapters";
import type { Credentials } from "./accounting-adapters";

// ─── Helpers ─────────────────────────────────────────────────────

async function getCredentials(integration: any): Promise<Credentials> {
  return {
    accessToken: integration.accessToken || "",
    refreshToken: integration.refreshToken || "",
    realmId: integration.realmId || undefined,
    tenantId: integration.tenantId || undefined,
    expiresAt: integration.tokenExpiresAt || undefined,
  };
}

async function withTokenRefresh<T>(
  integration: any,
  fn: (creds: Credentials) => Promise<T>,
): Promise<T> {
  let creds = await getCredentials(integration);
  const adapter = getAccountingAdapter(integration.provider);

  try {
    return await fn(creds);
  } catch (err: any) {
    if (err.message?.includes("TOKEN_EXPIRED") || err.message?.includes("401")) {
      // Refresh and retry once
      creds = await adapter.refreshTokens(creds);
      await db.accountingIntegration.update({
        where: { id: integration.id },
        data: {
          accessToken: creds.accessToken,
          refreshToken: creds.refreshToken,
          tokenExpiresAt: creds.expiresAt,
        },
      });
      return await fn(creds);
    }
    throw err;
  }
}

async function getExternalId(integrationId: string, entityType: string, internalId: string): Promise<string | null> {
  const mapping = await db.externalIdMapping.findUnique({
    where: { integrationId_entityType_internalId: { integrationId, entityType, internalId } },
  });
  return mapping?.externalId || null;
}

async function saveExternalId(integrationId: string, entityType: string, internalId: string, externalId: string) {
  await db.externalIdMapping.upsert({
    where: { integrationId_entityType_internalId: { integrationId, entityType, internalId } },
    create: { integrationId, entityType, internalId, externalId, lastSyncedAt: new Date() },
    update: { externalId, lastSyncedAt: new Date() },
  });
}

async function logSync(integrationId: string, entityType: string, entityId: string, externalId: string | null, action: string, error?: string) {
  await db.syncLog.create({
    data: {
      integrationId,
      direction: "TO_EXTERNAL",
      entityType,
      entityId,
      externalId,
      action: action as any,
      errorMessage: error,
    },
  });
}

// ─── Push Single Invoice ────────────────────────────────────────

export async function pushInvoice(invoiceId: string, firmId: string): Promise<{ success: boolean; error?: string }> {
  const integration = await db.accountingIntegration.findFirst({
    where: { isConnected: true },
  });
  if (!integration) return { success: false, error: "No accounting integration connected" };

  const adapter = getAccountingAdapter(integration.provider);
  const invoice = await db.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: {
      matter: { include: { client: true } },
      lineItems: true,
    },
  });

  if (!invoice.matter?.client) return { success: false, error: "Invoice has no client" };
  const client = invoice.matter.client;

  try {
    return await withTokenRefresh(integration, async (creds) => {
      // 1. Push client first
      const existingClientExtId = await getExternalId(integration.id, "CLIENT", client.id);
      const clientResult = await adapter.pushClient(
        { id: client.id, name: client.name, email: client.email, phone: client.phone, address: client.address },
        creds,
        existingClientExtId || undefined,
      );
      await saveExternalId(integration.id, "CLIENT", client.id, clientResult.externalId);
      await logSync(integration.id, "CLIENT", client.id, clientResult.externalId, clientResult.action === "created" ? "CREATED" : "UPDATED");

      // 2. Push invoice
      const existingInvExtId = await getExternalId(integration.id, "INVOICE", invoice.id);
      const invResult = await adapter.pushInvoice(
        {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          total: Number(invoice.total),
          dueDate: invoice.dueDate,
          issueDate: invoice.issueDate,
          lineItems: invoice.lineItems.map((li: any) => ({
            description: li.description || "Legal services",
            amount: Number(li.amount || li.total || 0),
            quantity: li.quantity || 1,
          })),
        },
        clientResult.externalId,
        creds,
        existingInvExtId || undefined,
      );
      await saveExternalId(integration.id, "INVOICE", invoice.id, invResult.externalId);
      await logSync(integration.id, "INVOICE", invoice.id, invResult.externalId, invResult.action === "created" ? "CREATED" : "UPDATED");

      return { success: true };
    });
  } catch (err: any) {
    await logSync(integration.id, "INVOICE", invoiceId, null, "FAILED", err.message);
    return { success: false, error: err.message };
  }
}

// ─── Push Single Payment ────────────────────────────────────────

export async function pushPayment(paymentId: string, firmId: string): Promise<{ success: boolean; error?: string }> {
  const integration = await db.accountingIntegration.findFirst({
    where: { isConnected: true },
  });
  if (!integration) return { success: false, error: "No accounting integration connected" };

  const adapter = getAccountingAdapter(integration.provider);
  const payment = await db.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { invoice: true },
  });

  const invoiceExtId = await getExternalId(integration.id, "INVOICE", payment.invoiceId);
  if (!invoiceExtId) return { success: false, error: "Invoice not synced to accounting system yet" };

  try {
    return await withTokenRefresh(integration, async (creds) => {
      const existingPayExtId = await getExternalId(integration.id, "PAYMENT", payment.id);
      const result = await adapter.pushPayment(
        {
          id: payment.id,
          amount: Number(payment.amount),
          paymentDate: payment.paymentDate,
          paymentMethod: payment.paymentMethod || undefined,
          reference: payment.reference || undefined,
        },
        invoiceExtId,
        creds,
        existingPayExtId || undefined,
      );
      await saveExternalId(integration.id, "PAYMENT", payment.id, result.externalId);
      await logSync(integration.id, "PAYMENT", payment.id, result.externalId, result.action === "created" ? "CREATED" : "UPDATED");

      return { success: true };
    });
  } catch (err: any) {
    await logSync(integration.id, "PAYMENT", paymentId, null, "FAILED", err.message);
    return { success: false, error: err.message };
  }
}

// ─── Sync All Pending ───────────────────────────────────────────

export async function syncAllPending(firmId: string): Promise<{ invoices: number; payments: number; errors: string[] }> {
  const integration = await db.accountingIntegration.findFirst({
    where: { isConnected: true },
  });
  if (!integration) return { invoices: 0, payments: 0, errors: ["No integration connected"] };

  // Find invoices without external mapping
  const syncedInvoiceIds = await db.externalIdMapping.findMany({
    where: { integrationId: integration.id, entityType: "INVOICE" },
    select: { internalId: true },
  });
  const syncedIds = new Set(syncedInvoiceIds.map((m) => m.internalId));

  const unsyncedInvoices = await db.invoice.findMany({
    where: { status: { in: ["SENT", "PAID", "OVERDUE"] } },
    select: { id: true },
    take: 50,
  });

  let invoiceCount = 0;
  let paymentCount = 0;
  const errors: string[] = [];

  for (const inv of unsyncedInvoices) {
    if (syncedIds.has(inv.id)) continue;
    const result = await pushInvoice(inv.id, firmId);
    if (result.success) invoiceCount++;
    else if (result.error) errors.push(`Invoice ${inv.id}: ${result.error}`);
  }

  // Find payments without external mapping
  const syncedPaymentIds = await db.externalIdMapping.findMany({
    where: { integrationId: integration.id, entityType: "PAYMENT" },
    select: { internalId: true },
  });
  const syncedPayIds = new Set(syncedPaymentIds.map((m) => m.internalId));

  const unsyncedPayments = await db.payment.findMany({
    where: { id: { notIn: Array.from(syncedPayIds) } },
    select: { id: true },
    take: 50,
  });

  for (const pay of unsyncedPayments) {
    const result = await pushPayment(pay.id, firmId);
    if (result.success) paymentCount++;
    else if (result.error) errors.push(`Payment ${pay.id}: ${result.error}`);
  }

  await db.accountingIntegration.update({
    where: { id: integration.id },
    data: { lastSyncAt: new Date(), syncStatus: errors.length > 0 ? "ERROR" : "IDLE", syncError: errors.length > 0 ? errors[0] : null },
  });

  return { invoices: invoiceCount, payments: paymentCount, errors };
}

// ─── Pull Payment Updates (one-way pull for payment status) ─────

export async function pullPaymentUpdates(firmId: string): Promise<{ updated: number; errors: string[] }> {
  const integration = await db.accountingIntegration.findFirst({
    where: { isConnected: true },
  });
  if (!integration) return { updated: 0, errors: ["No integration connected"] };

  const adapter = getAccountingAdapter(integration.provider);
  const since = integration.lastSyncAt || new Date(Date.now() - 7 * 86400000);
  let updated = 0;
  const errors: string[] = [];

  try {
    const creds = await getCredentials(integration);
    const externalInvoices = await adapter.pullInvoices(since, creds);

    for (const extInv of externalInvoices) {
      if (extInv.status !== "PAID") continue;

      // Find matching internal invoice
      const mapping = await db.externalIdMapping.findFirst({
        where: { integrationId: integration.id, entityType: "INVOICE", externalId: extInv.externalId },
      });
      if (!mapping) continue;

      const invoice = await db.invoice.findUnique({ where: { id: mapping.internalId } });
      if (!invoice || invoice.status === "PAID") continue;

      // QBO wins for payment status — mark as paid
      await db.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "PAID",
          amountPaid: extInv.total,
          paidAt: extInv.paidAt || new Date(),
        },
      });

      await logSync(integration.id, "INVOICE", invoice.id, extInv.externalId, "UPDATED");
      updated++;
    }
  } catch (err: any) {
    errors.push(err.message);
  }

  return { updated, errors };
}
