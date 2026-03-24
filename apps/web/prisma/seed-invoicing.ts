import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const FIRM_ID = "demo-firm";
const USER_ID = "demo-user";

async function main() {
  console.log("Seeding invoice templates...");

  const templates = [
    { id: "it-corp-hourly", name: "Corporate — Detailed Hourly", practiceArea: "corporate", billingModel: "hourly", isDefault: true, layout: "detailed", lineItemConfig: { timeEntries: { show: true, groupBy: "attorney", showDate: true, showAttorney: true, showDescription: true, showHours: true, showRate: true, showAmount: true, showTaskCode: true, subtotalByGroup: true, redactInternalNotes: true } }, expenseConfig: { show: true, detail: "itemized" }, summaryConfig: { showSubtotal: true, showExpenses: true, showTrustBalance: true, showAmountDue: true }, trustConfig: { showTrustBalance: true, showRetainerStatus: true }, styleConfig: { primaryColor: "#1B2A4A", fontFamily: "Inter", fontSize: "9pt" }, footerConfig: { paymentTerms: "Payment due within 30 days of invoice date.", showPaymentLink: true } },
    { id: "it-fl-phase", name: "Family Law — Phase Summary", practiceArea: "family_law", billingModel: "hybrid", isDefault: true, layout: "standard", lineItemConfig: { timeEntries: { show: true, groupBy: "phase", showDate: true, showDescription: true, showHours: true, showRate: true, showAmount: true, subtotalByGroup: true, phaseDescriptions: true, flatFeeDisplay: "phase_breakdown", redactInternalNotes: true } }, expenseConfig: { show: true, detail: "categorized" }, trustConfig: { showTrustBalance: true, showRetainerStatus: true, disclosureText: "Retainer funds held in IOLA trust account per NY Rules of Professional Conduct." }, styleConfig: { primaryColor: "#7C6DAF" }, clientFacingLanguage: { discovery: "financial disclosure", deposition: "testimony session" } },
    { id: "it-pi-expense", name: "PI — Expense Statement", practiceArea: "personal_injury", billingModel: "contingency", isDefault: true, layout: "expense_only", headerConfig: { customHeader: "CASE EXPENSE STATEMENT" }, lineItemConfig: { timeEntries: { show: false, contingencyDisplay: "expense_only" } }, expenseConfig: { show: true, detail: "itemized", showDate: true, showVendor: true, showCategory: true }, summaryConfig: { showExpenses: true, showAmountDue: false }, footerConfig: { paymentTerms: "Your case is handled on a contingency fee basis. No attorney fees are due at this time.", showPaymentLink: false }, styleConfig: { primaryColor: "#2B7A78" } },
    { id: "it-imm-flat", name: "Immigration — Flat Fee Progress", practiceArea: "immigration", billingModel: "flat_fee", isDefault: true, lineItemConfig: { timeEntries: { show: true, groupBy: "phase", flatFeeDisplay: "phase_breakdown", showHours: false, showRate: false, phaseDescriptions: true, redactInternalNotes: true } }, expenseConfig: { show: true, detail: "categorized" }, footerConfig: { paymentTerms: "Government filing fees separate from legal fees.", showPaymentLink: true }, styleConfig: { primaryColor: "#1A3A5C" } },
    { id: "it-lit-hourly", name: "Litigation — Standard Hourly", practiceArea: "litigation", billingModel: "hourly", isDefault: true, lineItemConfig: { timeEntries: { show: true, groupBy: "date", showDate: true, showAttorney: true, showDescription: true, showHours: true, showRate: true, showAmount: true, redactInternalNotes: true } }, expenseConfig: { show: true, detail: "itemized" }, summaryConfig: { showSubtotal: true, showExpenses: true, showTrustBalance: true, showAmountDue: true }, styleConfig: { primaryColor: "#1B2A4A" } },
    { id: "it-corp-sub", name: "Corporate — Monthly Retainer", practiceArea: "corporate", billingModel: "subscription", lineItemConfig: { timeEntries: { show: true, subscriptionDisplay: "base_plus_overage", groupBy: "task_category" } }, expenseConfig: { show: true, detail: "itemized" }, footerConfig: { paymentTerms: "Monthly retainer billed on the 1st." } },
    { id: "it-re-closing", name: "Real Estate — Closing Statement", practiceArea: "real_estate", billingModel: "flat_fee", isDefault: true, lineItemConfig: { timeEntries: { show: true, flatFeeDisplay: "single_line", showHours: false, showRate: false } }, expenseConfig: { show: true, detail: "itemized", showVendor: true }, footerConfig: { paymentTerms: "Due at closing." } },
    { id: "it-est-probate", name: "Estate — Probate Statement", practiceArea: "estate_planning", billingModel: "hybrid", isDefault: true, lineItemConfig: { timeEntries: { show: true, groupBy: "phase", phaseDescriptions: true, flatFeeDisplay: "phase_breakdown" } }, trustConfig: { showTrustBalance: true, showTrustDisclosure: true } },
  ];

  for (const t of templates) {
    await prisma.invoicingTemplate.upsert({
      where: { id: t.id },
      create: { ...t, isActive: true, firmId: null },
      update: { name: t.name },
    });
  }
  console.log(`Seeded ${templates.length} invoice templates.`);

  // PDF Config
  await prisma.invoicePDFConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default", firmName: "Rubinstein Law Firm", firmAddress: "Woodmere, NY 11598",
      firmPhone: "(516) 555-0000", firmEmail: "billing@rubinsteinlaw.com",
      firmBarNumber: "NY Bar #XXXXX",
      trustAccountDisclosure: "Client retainer funds maintained in IOLA account per Rule 1.15 of the NY Rules of Professional Conduct.",
      paymentInstructions: "Pay online through your client portal, or mail check to our office.",
    },
    update: {},
  });

  // Schedules
  await prisma.invoiceSchedule.upsert({
    where: { id: "sched-monthly" },
    create: {
      id: "sched-monthly", name: "Monthly Hourly Invoices", scheduleType: "monthly", dayOfMonth: 1,
      filterCriteria: { billingModels: ["hourly", "hybrid", "subscription"], minimumAmount: 50 },
      autoGenerate: true, autoAudit: true, autoApproveGradeA: false, autoSend: false,
      sendMethod: "portal_and_email", isActive: true,
      nextRunAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
      firmId: FIRM_ID,
    },
    update: {},
  });

  await prisma.invoiceSchedule.upsert({
    where: { id: "sched-quarterly-pi" },
    create: {
      id: "sched-quarterly-pi", name: "Quarterly PI Expense Statements", scheduleType: "quarterly", dayOfMonth: 1,
      filterCriteria: { billingModels: ["contingency"], practiceAreas: ["personal_injury"] },
      autoGenerate: true, autoAudit: true, autoApproveGradeA: true, autoSend: false,
      isActive: true, nextRunAt: new Date(new Date().getFullYear(), Math.ceil((new Date().getMonth() + 1) / 3) * 3, 1),
      firmId: FIRM_ID,
    },
    update: {},
  });

  // Demo invoices
  console.log("Seeding demo invoices...");
  const firstMatter = await prisma.matter.findFirst({ where: { status: "OPEN" }, include: { client: true } });
  if (firstMatter) {
    const invoices = [
      { invoiceNumber: "INV-2026-0001", matterName: firstMatter.name, clientName: firstMatter.client?.name || "Client", templateId: "it-lit-hourly", billingModel: "hourly", practiceArea: firstMatter.practiceArea, subtotal: 8450, totalHours: 24.5, totalDue: 8950, expenseTotal: 500, auditGrade: "A", status: "paid", paidAmount: 8950 },
      { invoiceNumber: "INV-2026-0002", matterName: firstMatter.name, clientName: firstMatter.client?.name || "Client", templateId: "it-fl-phase", billingModel: "hybrid", practiceArea: "family_law", subtotal: 3187.50, totalHours: 8.5, totalDue: 3437.50, expenseTotal: 250, auditGrade: "B", status: "sent" },
      { invoiceNumber: "INV-2026-0003", matterName: firstMatter.name, clientName: firstMatter.client?.name || "Client", templateId: "it-pi-expense", billingModel: "contingency", practiceArea: "personal_injury", subtotal: 0, totalDue: 0, expenseTotal: 7125, auditGrade: "A", status: "sent" },
    ];

    for (const inv of invoices) {
      await prisma.generatedInvoice.upsert({
        where: { invoiceNumber: inv.invoiceNumber },
        create: {
          ...inv,
          matterId: firstMatter.id,
          clientEmail: firstMatter.client?.email,
          periodStart: new Date(2026, 1, 1),
          periodEnd: new Date(2026, 1, 28),
          dueDate: new Date(2026, 2, 30),
          lineItems: [],
          sentAt: inv.status !== "draft" ? new Date() : null,
          paidAt: inv.status === "paid" ? new Date() : null,
          userId: USER_ID,
          firmId: FIRM_ID,
        },
        update: {},
      });
    }
    console.log(`Seeded ${invoices.length} demo invoices.`);
  }

  console.log("Invoicing seed complete!");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
