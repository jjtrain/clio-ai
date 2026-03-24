import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding API integrations data...");

  // Create demo API keys
  const demoKey1 = "mng_live_demo_zapier_key_12345678";
  const demoKey2 = "mng_live_demo_make_key_87654321";

  const keys = [
    { name: "Zapier Integration", rawKey: demoKey1, scopes: "LEADS_READ,LEADS_WRITE,MATTERS_READ,CONTACTS_READ,CONTACTS_WRITE,WEBHOOKS_MANAGE" },
    { name: "Make – Intake Forms", rawKey: demoKey2, scopes: "LEADS_READ,LEADS_WRITE,CONTACTS_WRITE" },
  ];

  let keyCount = 0;
  const createdKeys: any[] = [];
  for (const key of keys) {
    const keyHash = bcrypt.hashSync(key.rawKey, 10);
    const keyPrefix = key.rawKey.slice(0, 12);
    const existing = await prisma.apiKey.findFirst({ where: { name: key.name, isActive: true } });
    if (existing) {
      createdKeys.push(existing);
      continue;
    }
    const created = await prisma.apiKey.create({
      data: { name: key.name, keyHash, keyPrefix, scopes: key.scopes, lastUsedAt: new Date(Date.now() - 3600000) },
    });
    createdKeys.push(created);
    keyCount++;
  }

  // Create demo webhook subscription
  if (createdKeys[0]) {
    const existing = await prisma.webhookSubscription.findFirst({ where: { event: "LEAD_CREATED" } });
    if (!existing) {
      await prisma.webhookSubscription.create({
        data: {
          firmId: "demo-firm",
          apiKeyId: createdKeys[0].id,
          event: "LEAD_CREATED",
          targetUrl: "https://hooks.zapier.com/hooks/catch/123456/abcdef/",
          secret: "demo-webhook-secret-12345",
          description: "Zapier: New Lead → Slack notification",
          lastFiredAt: new Date(Date.now() - 7200000),
          lastSuccessAt: new Date(Date.now() - 7200000),
        },
      });
    }
  }

  // Create demo automation logs
  const logActions = [
    { source: "zapier", action: "CREATE_LEAD", resourceType: "Lead", success: true },
    { source: "zapier", action: "CREATE_LEAD", resourceType: "Lead", success: true },
    { source: "make", action: "CREATE_CONTACT", resourceType: "Contact", success: true },
    { source: "api", action: "LIST_MATTERS", resourceType: "Matter", success: true },
    { source: "zapier", action: "CREATE_LEAD", resourceType: "Lead", success: false, errorMsg: "Duplicate email: john@example.com" },
    { source: "make", action: "CONVERT_LEAD", resourceType: "Lead", success: true },
  ];

  let logCount = 0;
  const existingLogs = await prisma.automationLog.count();
  if (existingLogs < 3) {
    for (const log of logActions) {
      await prisma.automationLog.create({
        data: { ...log, firmId: "demo-firm", apiKeyId: createdKeys[0]?.id },
      });
      logCount++;
    }
  }

  console.log(`Seeded ${keyCount} API keys, 1 webhook subscription, ${logCount} automation logs.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
