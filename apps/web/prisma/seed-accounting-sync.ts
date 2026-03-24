import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding accounting sync data...");

  // Create a mock QuickBooks integration (not actually connected, for UI demo)
  const qboIntegration = await prisma.accountingIntegration.upsert({
    where: { provider: "QUICKBOOKS" },
    create: {
      provider: "QUICKBOOKS",
      isEnabled: true,
      isConnected: false, // Not actually connected — mock data
      companyName: "Demo Law Firm (Sandbox)",
      syncDirection: "TO_EXTERNAL",
      realmId: "4620816365185389650",
      lastSyncAt: new Date(Date.now() - 86400000),
      syncStatus: "IDLE",
    },
    update: {},
  });

  // Create a mock Xero integration
  await prisma.accountingIntegration.upsert({
    where: { provider: "XERO" },
    create: {
      provider: "XERO",
      isEnabled: false,
      isConnected: false,
      syncDirection: "TO_EXTERNAL",
    },
    update: {},
  });

  // Create mock ExternalIdMappings for some invoices
  const invoices = await prisma.invoice.findMany({ take: 8, select: { id: true, invoiceNumber: true } });
  const clients = await prisma.client.findMany({ take: 4, select: { id: true } });

  let mappings = 0;
  let logs = 0;

  for (let i = 0; i < Math.min(clients.length, 4); i++) {
    await prisma.externalIdMapping.upsert({
      where: {
        integrationId_entityType_internalId: {
          integrationId: qboIntegration.id,
          entityType: "CLIENT",
          internalId: clients[i].id,
        },
      },
      create: {
        integrationId: qboIntegration.id,
        entityType: "CLIENT",
        internalId: clients[i].id,
        externalId: `QBO-CUST-${1000 + i}`,
        lastSyncedAt: new Date(Date.now() - 86400000 * (i + 1)),
      },
      update: {},
    });
    mappings++;
  }

  for (let i = 0; i < Math.min(invoices.length, 6); i++) {
    await prisma.externalIdMapping.upsert({
      where: {
        integrationId_entityType_internalId: {
          integrationId: qboIntegration.id,
          entityType: "INVOICE",
          internalId: invoices[i].id,
        },
      },
      create: {
        integrationId: qboIntegration.id,
        entityType: "INVOICE",
        internalId: invoices[i].id,
        externalId: `QBO-INV-${2000 + i}`,
        lastSyncedAt: new Date(Date.now() - 86400000 * (i + 1)),
      },
      update: {},
    });
    mappings++;

    // Create sync logs for these
    const existing = await prisma.syncLog.findFirst({
      where: { integrationId: qboIntegration.id, entityId: invoices[i].id, entityType: "INVOICE" },
    });
    if (!existing) {
      await prisma.syncLog.create({
        data: {
          integrationId: qboIntegration.id,
          direction: "TO_EXTERNAL",
          entityType: "INVOICE",
          entityId: invoices[i].id,
          externalId: `QBO-INV-${2000 + i}`,
          action: "CREATED",
        },
      });
      logs++;
    }
  }

  // Add a couple of client sync logs
  for (let i = 0; i < Math.min(clients.length, 3); i++) {
    const existing = await prisma.syncLog.findFirst({
      where: { integrationId: qboIntegration.id, entityId: clients[i].id, entityType: "CLIENT" },
    });
    if (!existing) {
      await prisma.syncLog.create({
        data: {
          integrationId: qboIntegration.id,
          direction: "TO_EXTERNAL",
          entityType: "CLIENT",
          entityId: clients[i].id,
          externalId: `QBO-CUST-${1000 + i}`,
          action: "CREATED",
        },
      });
      logs++;
    }
  }

  // Add a failed sync log for realism
  const failExists = await prisma.syncLog.findFirst({
    where: { integrationId: qboIntegration.id, action: "FAILED" },
  });
  if (!failExists) {
    await prisma.syncLog.create({
      data: {
        integrationId: qboIntegration.id,
        direction: "TO_EXTERNAL",
        entityType: "INVOICE",
        entityId: invoices[invoices.length - 1]?.id || "unknown",
        action: "FAILED",
        errorMessage: "QBO API error 400: Invoice line items total does not match invoice total",
      },
    });
    logs++;
  }

  console.log(`Seeded ${mappings} external ID mappings and ${logs} sync logs.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
