import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const FIRM_ID = "demo-firm";
const USER_ID = "demo-user";

async function main() {
  console.log("Seeding quick invoice presets...");
  const presets = [
    { id: "qip-johnson", name: "Monthly Retainer — Johnson Corp", matterId: null, presetType: "recurring_retainer", autoInclude: { unbilledTimeEntries: true, unbilledExpenses: true, periodDays: 30 }, defaultNote: "Thank you for your continued partnership.", sendMethod: ["portal", "email"], applyTrustCredit: false, isPinned: true },
    { id: "qip-rodriguez", name: "Rodriguez Immigration — Phase Payment", matterId: null, presetType: "flat_fee_phase", autoInclude: { unbilledTimeEntries: false, unbilledExpenses: true, periodDays: 0 }, defaultNote: "Payment for your current application phase. Government filing fees listed separately.", sendMethod: ["portal", "email"], isPinned: true },
    { id: "qip-family", name: "Smith Family Law — Monthly Hourly", matterId: null, presetType: "hourly_periodic", autoInclude: { unbilledTimeEntries: true, unbilledExpenses: true, periodDays: 30 }, sendMethod: ["portal", "email"], applyTrustCredit: true },
    { id: "qip-pi-expense", name: "PI Cases — Quarterly Expense Statement", presetType: "expense_statement", practiceArea: "personal_injury", autoInclude: { unbilledTimeEntries: false, unbilledExpenses: true, periodDays: 90 }, defaultNote: "This is a summary of case expenses advanced on your behalf. No attorney fees are due at this time.", sendMethod: ["portal"] },
  ];

  for (const p of presets) {
    await prisma.quickInvoicePreset.upsert({
      where: { id: p.id },
      create: { ...p, userId: USER_ID, firmId: FIRM_ID },
      update: {},
    });
  }
  console.log(`Seeded ${presets.length} presets.`);

  console.log("Seeding demo quick invoices...");
  const now = new Date();

  const invoices = [
    { matterName: "Johnson Corp", clientName: "James Johnson", amount: 4200, hours: 7.7, amountDue: 4200, description: "March 2026 Retainer ($1,500) + 7.7 hrs overage ($2,700)", generatedInSeconds: 28, status: "paid", sentAt: new Date(now.getTime() - 2 * 86400000), paidAt: new Date(now.getTime() - 1 * 86400000) },
    { matterName: "Rodriguez Immigration", clientName: "Maria Rodriguez", amount: 2035, hours: 0, expenseAmount: 535, amountDue: 2035, description: "Phase 2 flat fee $1,500 + USCIS filing fee $535", generatedInSeconds: 42, status: "sent", sentAt: new Date(now.getTime() - 5 * 86400000) },
    { matterName: "Smith Family Law", clientName: "John Smith", amount: 3437.50, hours: 8.5, trustCreditApplied: 3437.50, amountDue: 0, description: "8.5 hrs hourly ($3,187.50) + $250 expenses — fully covered by retainer", generatedInSeconds: 35, status: "sent", sentAt: new Date(now.getTime() - 1 * 86400000) },
  ];

  const firstMatter = await prisma.matter.findFirst({ where: { status: "OPEN" } });
  for (const inv of invoices) {
    await prisma.quickInvoice.create({
      data: { matterId: firstMatter?.id || "demo", ...inv, sendMethod: ["portal", "email"], source: "quick_mobile", userId: USER_ID, firmId: FIRM_ID },
    });
  }
  console.log(`Seeded ${invoices.length} quick invoices.`);

  // Seed candidates
  if (firstMatter) {
    await prisma.quickInvoiceCandidate.upsert({
      where: { matterId_firmId: { matterId: firstMatter.id, firmId: FIRM_ID } },
      create: { matterId: firstMatter.id, matterName: firstMatter.name, clientName: "John Smith", practiceArea: firstMatter.practiceArea, unbilledAmount: 3425, unbilledHours: 9.5, daysSinceLastInvoice: 32, trustBalance: 5000, isOneTapReady: true, priority: 8, firmId: FIRM_ID },
      update: {},
    });
  }

  console.log("Quick invoice seed complete!");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
