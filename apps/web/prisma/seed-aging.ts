import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding aging receivables data...");

  const firstMatter = await prisma.matter.findFirst({ where: { status: "OPEN" } });
  if (!firstMatter) { console.log("No matter found — skipping."); return; }

  const now = new Date();

  // Create invoices at different aging stages
  const invoices = [
    // Current (not overdue)
    { num: "INV-AGING-001", days: -5, total: 2500, paid: 0, stage: null },
    { num: "INV-AGING-002", days: -10, total: 1800, paid: 0, stage: null },

    // 30-day bucket
    { num: "INV-AGING-003", days: 35, total: 4200, paid: 0, stage: null }, // no escalation yet
    { num: "INV-AGING-004", days: 38, total: 3100, paid: 500, stage: "REMINDER_30" }, // already reminded

    // 60-day bucket
    { num: "INV-AGING-005", days: 62, total: 5500, paid: 0, stage: "REMINDER_30" }, // needs 60-day
    { num: "INV-AGING-006", days: 68, total: 2800, paid: 1000, stage: "REMINDER_60" }, // already at 60

    // 90+ bucket
    { num: "INV-AGING-007", days: 95, total: 8200, paid: 0, stage: "REMINDER_60" }, // needs demand
    { num: "INV-AGING-008", days: 120, total: 3500, paid: 0, stage: "DEMAND_90" }, // needs collections
    { num: "INV-AGING-009", days: 145, total: 6100, paid: 2000, stage: "COLLECTIONS" }, // in collections
  ];

  for (const inv of invoices) {
    const dueDate = new Date(now.getTime() - inv.days * 86400000);
    const issueDate = new Date(dueDate.getTime() - 30 * 86400000);

    await prisma.invoice.upsert({
      where: { invoiceNumber: inv.num },
      create: {
        invoiceNumber: inv.num,
        matterId: firstMatter.id,
        status: inv.days > 0 ? "OVERDUE" : "SENT",
        issueDate,
        dueDate,
        subtotal: inv.total,
        taxRate: 0,
        taxAmount: 0,
        total: inv.total,
        amountPaid: inv.paid,
        sentAt: issueDate,
        escalationStage: inv.stage,
        lastEscalationAt: inv.stage ? new Date(now.getTime() - 7 * 86400000) : null,
      },
      update: { escalationStage: inv.stage },
    });
  }
  console.log(`Seeded ${invoices.length} invoices across aging buckets.`);

  // Add escalation history for invoices that have been escalated
  const escalationHistory = [
    { num: "INV-AGING-004", stage: "REMINDER_30", daysAgo: 5, method: "email", response: "no_response" },
    { num: "INV-AGING-005", stage: "REMINDER_30", daysAgo: 30, method: "email", response: "no_response" },
    { num: "INV-AGING-006", stage: "REMINDER_30", daysAgo: 35, method: "email", response: "no_response" },
    { num: "INV-AGING-006", stage: "REMINDER_60", daysAgo: 8, method: "email", response: "payment_plan_requested" },
    { num: "INV-AGING-007", stage: "REMINDER_30", daysAgo: 60, method: "email", response: "no_response" },
    { num: "INV-AGING-007", stage: "REMINDER_60", daysAgo: 30, method: "email", response: "no_response" },
    { num: "INV-AGING-008", stage: "REMINDER_30", daysAgo: 85, method: "email", response: "no_response" },
    { num: "INV-AGING-008", stage: "REMINDER_60", daysAgo: 55, method: "email", response: "no_response" },
    { num: "INV-AGING-008", stage: "DEMAND_90", daysAgo: 25, method: "letter", response: "no_response" },
    { num: "INV-AGING-009", stage: "REMINDER_30", daysAgo: 110, method: "email", response: "no_response" },
    { num: "INV-AGING-009", stage: "REMINDER_60", daysAgo: 80, method: "email", response: "disputed" },
    { num: "INV-AGING-009", stage: "DEMAND_90", daysAgo: 50, method: "letter", response: "no_response" },
    { num: "INV-AGING-009", stage: "COLLECTIONS", daysAgo: 20, method: "letter", response: null },
  ];

  for (const esc of escalationHistory) {
    const inv = await prisma.invoice.findUnique({ where: { invoiceNumber: esc.num } });
    if (!inv) continue;

    await prisma.receivableEscalation.create({
      data: {
        invoiceId: inv.id,
        firmId: "demo-firm",
        stage: esc.stage,
        method: esc.method,
        subject: `${esc.stage.replace(/_/g, " ")} — ${esc.num}`,
        sentAt: new Date(now.getTime() - esc.daysAgo * 86400000),
        response: esc.response,
        respondedAt: esc.response ? new Date(now.getTime() - (esc.daysAgo - 2) * 86400000) : null,
      },
    });
  }
  console.log(`Seeded ${escalationHistory.length} escalation history entries.`);

  console.log("Aging receivables seed complete!");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
