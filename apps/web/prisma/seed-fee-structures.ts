import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const FIRM_ID = "demo-firm";
const USER_ID = "demo-user";

async function main() {
  console.log("Seeding fee structure templates...");

  const templates = [
    {
      id: "fst-pi-contingency",
      name: "PI — Standard Pre-Lit + Contingency",
      practiceArea: "personal_injury",
      caseType: "auto_accident",
      isDefault: true,
      phases: [
        { id: "pi-ph1", name: "Investigation & Demand", billingModel: "no_charge", clientDescription: "No charge — firm advances all costs during this phase.", linkedCasePhase: "pre_litigation" },
        { id: "pi-ph2", name: "Litigation", billingModel: "contingency", clientDescription: "Contingency fee based on recovery amount.", linkedCasePhase: "pleadings" },
      ],
      contingencySchedule: [
        { tierName: "Pre-Litigation Settlement", percentage: 33.33, trigger: "pre_suit" },
        { tierName: "Post-Filing Settlement", percentage: 33.33, trigger: "post_filing" },
        { tierName: "Post-Trial", percentage: 40, trigger: "post_trial" },
      ],
      expenseHandling: "advance_required",
      retainerRequired: false,
      totalEstimate: { low: 0, midpoint: 0, high: 0, notes: "Contingency — no upfront fees" },
      clientFacingDescription: "Your case is handled on a contingency fee basis — you pay nothing upfront and nothing unless we recover for you. If we recover compensation, our fee is one-third (33.33%) of the recovery. If the case goes to trial, the fee is 40%.",
    },
    {
      id: "fst-fl-uncontested",
      name: "Family Law — Uncontested Divorce",
      practiceArea: "family_law",
      caseType: "uncontested_divorce",
      isDefault: true,
      phases: [
        { id: "fl-ph1", name: "Document Preparation & Filing", billingModel: "flat_fee", flatFeeAmount: 3500, clientDescription: "Covers preparing all divorce paperwork, filing with the court, and guiding you through the process." },
        { id: "fl-ph2", name: "Post-Filing / Complications", billingModel: "hourly", estimatedHours: { low: 0, high: 10 }, clientDescription: "If complications arise after filing, this work is billed hourly. Many uncontested divorces don't need this." },
      ],
      retainerRequired: true, retainerAmount: 1750, retainerType: "deposit_against_fees",
      expenseHandling: "pass_through",
      totalEstimate: { low: 3500, midpoint: 4750, high: 7000 },
    },
    {
      id: "fst-fl-contested",
      name: "Family Law — Contested Divorce",
      practiceArea: "family_law",
      caseType: "contested_divorce",
      isDefault: true,
      phases: [
        { id: "flc-ph1", name: "Filing & Initial Motions", billingModel: "flat_fee", flatFeeAmount: 5000 },
        { id: "flc-ph2", name: "Discovery & Financial Disclosure", billingModel: "hourly", estimatedHours: { low: 15, high: 40 } },
        { id: "flc-ph3", name: "Negotiation & Mediation", billingModel: "flat_fee", flatFeeAmount: 3000 },
        { id: "flc-ph4", name: "Trial Preparation", billingModel: "hourly", estimatedHours: { low: 20, high: 50 } },
        { id: "flc-ph5", name: "Trial", billingModel: "hourly", estimatedHours: { low: 15, high: 40 } },
      ],
      retainerRequired: true, retainerAmount: 7500, retainerType: "evergreen", retainerReplenishThreshold: 2000,
      totalEstimate: { low: 12000, midpoint: 25000, high: 45000 },
    },
    {
      id: "fst-imm-visa",
      name: "Immigration — Standard Visa Application",
      practiceArea: "immigration",
      caseType: "visa",
      isDefault: true,
      phases: [
        { id: "imm-ph1", name: "Document Preparation & Filing", billingModel: "flat_fee", flatFeeAmount: 4500, clientDescription: "Covers preparing your application, gathering supporting documents, and filing with USCIS." },
        { id: "imm-ph2", name: "RFE Response", billingModel: "flat_fee", flatFeeAmount: 1500, triggerToStart: "rfe_received", clientDescription: "If USCIS requests additional information." },
        { id: "imm-ph3", name: "Interview Preparation", billingModel: "flat_fee", flatFeeAmount: 1000, triggerToStart: "interview_scheduled", clientDescription: "Preparing you for your USCIS interview." },
      ],
      expenseHandling: "pass_through", retainerRequired: false,
      totalEstimate: { low: 4500, midpoint: 5500, high: 7000, notes: "Phases 2-3 may not apply" },
    },
    {
      id: "fst-corp-formation",
      name: "Corporate — Formation + Monthly Counsel",
      practiceArea: "corporate",
      caseType: "entity_formation",
      isDefault: true,
      phases: [
        { id: "corp-ph1", name: "Entity Formation", billingModel: "flat_fee", flatFeeAmount: 2500, clientDescription: "Formation of business entity including all documents and filings." },
        { id: "corp-ph2", name: "Ongoing General Counsel", billingModel: "subscription", subscriptionAmount: 1500, subscriptionIncludedHours: 5, subscriptionOverageRate: 350, clientDescription: "Monthly retainer — 5 hours included, $350/hr overage." },
      ],
      totalEstimate: { low: 2500, midpoint: 20500, high: 38500, notes: "12 months ongoing" },
    },
    {
      id: "fst-re-closing",
      name: "Real Estate — Residential Purchase/Sale",
      practiceArea: "real_estate",
      caseType: "residential_closing",
      isDefault: true,
      phases: [
        { id: "re-ph1", name: "Full Closing Representation", billingModel: "flat_fee", flatFeeAmount: 2000, clientDescription: "Complete legal representation for your home purchase/sale." },
      ],
      expenseHandling: "pass_through",
      totalEstimate: { low: 2000, midpoint: 2000, high: 2000 },
    },
    {
      id: "fst-estate-probate",
      name: "Estate — Standard Probate",
      practiceArea: "estate_planning",
      caseType: "probate",
      isDefault: true,
      phases: [
        { id: "est-ph1", name: "Petition & Filing", billingModel: "flat_fee", flatFeeAmount: 3500 },
        { id: "est-ph2", name: "Estate Administration", billingModel: "hourly", estimatedHours: { low: 10, high: 30 } },
        { id: "est-ph3", name: "Accounting & Distribution", billingModel: "flat_fee", flatFeeAmount: 2000 },
      ],
      totalEstimate: { low: 5500, midpoint: 9500, high: 16000 },
    },
    {
      id: "fst-lit-hourly",
      name: "Litigation — Standard Hourly",
      practiceArea: "litigation",
      isDefault: true,
      phases: [
        { id: "lit-ph1", name: "All Phases", billingModel: "hourly" },
      ],
      retainerRequired: true, retainerAmount: 10000, retainerType: "evergreen", retainerReplenishThreshold: 2500,
      totalEstimate: { low: 10000, high: 75000 },
    },
  ];

  for (const t of templates) {
    await prisma.feeStructureTemplate.upsert({
      where: { id: t.id },
      create: { ...t, isActive: true, firmId: null },
      update: { name: t.name, phases: t.phases },
    });
  }
  console.log(`Seeded ${templates.length} templates.`);

  // Default rates
  console.log("Seeding hourly rates...");
  const rates = [
    { role: "partner", rate: 400 },
    { role: "senior_associate", rate: 300 },
    { role: "associate", rate: 225 },
    { role: "junior_associate", rate: 175 },
    { role: "paralegal", rate: 150 },
    { role: "law_clerk", rate: 125 },
    { role: "of_counsel", rate: 350 },
  ];
  for (const r of rates) {
    await prisma.hourlyRateSchedule.create({
      data: { ...r, firmId: FIRM_ID },
    });
  }
  console.log(`Seeded ${rates.length} default rates.`);

  // Apply to demo matters
  const firstMatter = await prisma.matter.findFirst({ where: { status: "OPEN" } });
  if (firstMatter) {
    console.log("Applying fee structure to demo matter...");
    await prisma.matterFeeStructure.upsert({
      where: { matterId: firstMatter.id },
      create: {
        matterId: firstMatter.id,
        templateId: "fst-pi-contingency",
        templateName: "PI — Standard Pre-Lit + Contingency",
        phases: templates[0].phases,
        contingencySchedule: templates[0].contingencySchedule,
        retainerRequired: false,
        expenseHandling: "advance_required",
        totalEstimate: templates[0].totalEstimate,
        clientFacingDescription: templates[0].clientFacingDescription,
        currentPhaseId: "pi-ph1",
        totalExpenses: 2500,
        budgetAlertThreshold: 0.8,
        userId: USER_ID,
        firmId: FIRM_ID,
      },
      update: {},
    });

    await prisma.phaseCompletion.create({
      data: {
        feeStructureId: (await prisma.matterFeeStructure.findUnique({ where: { matterId: firstMatter.id } }))!.id,
        phaseId: "pi-ph1",
        phaseName: "Investigation & Demand",
        billingModel: "no_charge",
        status: "active",
        startedAt: new Date(Date.now() - 60 * 86400000),
        userId: USER_ID,
        firmId: FIRM_ID,
      },
    });
    console.log("Applied PI contingency to demo matter.");
  }

  console.log("Fee structure seed complete!");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
