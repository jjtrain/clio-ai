import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const FIRM_ID = "demo-firm";
const USER_ID = "demo-user";

async function main() {
  const firstMatter = await prisma.matter.findFirst({ where: { status: "OPEN" } });
  if (!firstMatter) { console.log("No matter — skipping."); return; }

  console.log("Seeding contingency case...");
  const cc = await prisma.contingencyCase.upsert({
    where: { matterId: firstMatter.id },
    create: {
      matterId: firstMatter.id, matterName: firstMatter.name, clientName: "John Smith", caseType: "auto_accident",
      incidentDate: new Date("2026-02-15"), solDate: new Date("2029-02-15"),
      feePercentage: 33.33, feeBase: "gross_recovery", feeTier: "tiered",
      feeTiers: [{ stage: "pre_litigation", percentage: 33.33 }, { stage: "post_filing", percentage: 33.33 }, { stage: "post_trial", percentage: 40 }],
      currentStage: "pre_litigation", effectiveFeePercentage: 33.33,
      totalExpensesAdvanced: 12400, totalExpensesBudgeted: 18500, totalHoursInvested: 45.5, blendedHourlyRate: 350,
      insurancePolicyLimits: 300000, insuranceCarrier: "State Farm", claimNumber: "CL-2026-12345",
      adjustorName: "Mike Thompson", adjustorPhone: "(800) 555-0150",
      demandAmount: 250000, demandDate: new Date("2026-03-01"),
      lastOfferAmount: 85000, lastOfferDate: new Date("2026-03-15"),
      medicalSpecials: 89500, lostWages: 22000, propertyDamage: 4500,
      settlementTarget: { low: 175000, midpoint: 225000, high: 300000 },
      userId: USER_ID, firmId: FIRM_ID,
    },
    update: {},
  });

  // Expenses
  console.log("Seeding expenses...");
  const expenses = [
    { category: "filing_fee", description: "Supreme Court filing fee", vendor: "Nassau County Clerk", amount: 210, datePaid: new Date("2026-01-20") },
    { category: "service_fee", description: "Service of process", vendor: "ABC Process Service", amount: 125, datePaid: new Date("2026-01-22") },
    { category: "medical_records", description: "Records — Hempstead Orthopedics", vendor: "Hempstead Orthopedics", amount: 175, datePaid: new Date("2026-01-15") },
    { category: "medical_records", description: "ER records — Hempstead Hospital", vendor: "Hempstead Hospital", amount: 225, datePaid: new Date("2026-01-15") },
    { category: "medical_records", description: "PT records", vendor: "PT Associates", amount: 125, datePaid: new Date("2026-01-18") },
    { category: "medical_records", description: "MRI imaging records", vendor: "LI Radiology", amount: 150, datePaid: new Date("2026-01-20") },
    { category: "medical_records", description: "Pain management records", vendor: "Dr. Park", amount: 175, datePaid: new Date("2026-02-05") },
    { category: "expert_medical", description: "IME and narrative report — Dr. Marcus", vendor: "Dr. Alan Marcus, MD", amount: 5000, datePaid: new Date("2026-02-20") },
    { category: "deposition_transcript", description: "Deposition transcript — Defendant", vendor: "NY Court Reporters", amount: 2200, datePaid: new Date("2026-03-05") },
    { category: "deposition_transcript", description: "Deposition transcript — Plaintiff", vendor: "NY Court Reporters", amount: 1300, datePaid: new Date("2026-03-10") },
    { category: "investigation", description: "Scene investigation and photography", vendor: "Metro Investigations", amount: 1200, datePaid: new Date("2026-01-25") },
    { category: "copying", description: "Document copying, postage", amount: 450, datePaid: new Date("2026-03-01") },
    { category: "other", description: "Certified motor vehicle abstracts", vendor: "NY DMV", amount: 40, datePaid: new Date("2026-01-12") },
    { category: "police_report", description: "Accident report", vendor: "Nassau County PD", amount: 25, datePaid: new Date("2026-01-10") },
  ];
  for (const e of expenses) { await prisma.caseExpense.create({ data: { caseId: cc.id, ...e, paymentStatus: "paid", firmId: FIRM_ID } }); }

  // Liens
  console.log("Seeding liens...");
  const liens = [
    { lienType: "medical_provider", lienHolder: "Hempstead Orthopedics", originalAmount: 12000, negotiatedAmount: 8500, reductionPercentage: 29.2, reductionMethod: "negotiated", status: "negotiated", letterOfProtection: true },
    { lienType: "medical_provider", lienHolder: "Physical Therapy Associates", originalAmount: 6000, negotiatedAmount: 4200, reductionPercentage: 30, reductionMethod: "negotiated", status: "negotiated" },
    { lienType: "medical_provider", lienHolder: "Hempstead Hospital ER", originalAmount: 4000, status: "asserted" },
    { lienType: "medical_provider", lienHolder: "Dr. Park — Pain Management", originalAmount: 3500, status: "asserted", letterOfProtection: true },
    { lienType: "health_insurance_subrogation", lienHolder: "Aetna Health Insurance", originalAmount: 12000, negotiatedAmount: 8500, reductionPercentage: 29.2, reductionMethod: "common_fund", status: "negotiated" },
    { lienType: "medicare_conditional", lienHolder: "Medicare / BCRC", originalAmount: 3300, status: "verified", isPriority: true, isStatutory: true },
  ];
  for (const l of liens) { await prisma.caseLien.create({ data: { caseId: cc.id, ...l, firmId: FIRM_ID } }); }

  // Damages
  console.log("Seeding damages...");
  const damages = [
    { damageType: "medical_past", category: "economic", description: "Past medical expenses", amountActual: 67500, documentedBy: "Medical bills from 6 providers", verificationStatus: "documented" },
    { damageType: "medical_future", category: "economic", description: "Future medical treatment (12-18 months PT + possible surgery)", amountLow: 10000, amountMidpoint: 15000, amountHigh: 45000, documentedBy: "Dr. Rodriguez + Dr. Marcus IME", verificationStatus: "verified_by_expert" },
    { damageType: "lost_wages_past", category: "economic", description: "Lost wages — 8 weeks missed work", amountActual: 22000, documentedBy: "Employer letter + pay stubs", verificationStatus: "documented" },
    { damageType: "pain_suffering_past", category: "non_economic", description: "Past pain and suffering — herniated disc L4-L5", amountLow: 100000, amountMidpoint: 150000, amountHigh: 200000, verificationStatus: "estimated" },
    { damageType: "pain_suffering_future", category: "non_economic", description: "Future pain and suffering — permanent disc injury", amountLow: 50000, amountMidpoint: 100000, amountHigh: 150000, verificationStatus: "estimated" },
    { damageType: "loss_enjoyment", category: "non_economic", description: "Loss of enjoyment of life", amountLow: 25000, amountMidpoint: 50000, amountHigh: 75000, verificationStatus: "estimated" },
  ];
  for (const d of damages) { await prisma.damageComponent.create({ data: { caseId: cc.id, ...d, firmId: FIRM_ID } }); }

  // Negotiations
  const negotiations = [
    { eventType: "demand", amount: 250000, date: new Date("2026-03-01"), notes: "Initial demand package sent to State Farm" },
    { eventType: "offer", amount: 45000, date: new Date("2026-03-08"), notes: "Initial offer — below specials" },
    { eventType: "counter", amount: 225000, date: new Date("2026-03-10"), notes: "Counter with supplemental demand" },
    { eventType: "offer", amount: 85000, date: new Date("2026-03-15"), notes: "Revised offer — adjustor indicated room to move" },
  ];
  for (const n of negotiations) { await prisma.negotiationEvent.create({ data: { caseId: cc.id, ...n, firmId: FIRM_ID } }); }

  // Scenarios
  const scenarios = [
    { scenarioName: "Policy Limits ($300K)", settlementAmount: 300000, feePercentage: 33.33, feeAmount: 99990, expenses: 12400, lienTotal: 28500, clientNet: 159110, effectiveHourlyRate: 2198, roi: 807 },
    { scenarioName: "Demand ($250K)", settlementAmount: 250000, feePercentage: 33.33, feeAmount: 83325, expenses: 12400, lienTotal: 28500, clientNet: 125775, effectiveHourlyRate: 1832, roi: 672 },
    { scenarioName: "Target ($175K)", settlementAmount: 175000, feePercentage: 33.33, feeAmount: 58328, expenses: 12400, lienTotal: 28500, clientNet: 75772, effectiveHourlyRate: 1282, roi: 470 },
    { scenarioName: "Last Offer ($85K)", settlementAmount: 85000, feePercentage: 33.33, feeAmount: 28330, expenses: 12400, lienTotal: 28500, clientNet: 15770, effectiveHourlyRate: 623, roi: 228 },
    { scenarioName: "Break-Even ($18.6K)", settlementAmount: 18601, feePercentage: 33.33, feeAmount: 6200, expenses: 12400, lienTotal: 0, clientNet: 1, effectiveHourlyRate: 136, roi: -50 },
  ];
  for (const s of scenarios) { await prisma.settlementScenario.create({ data: { caseId: cc.id, ...s, firmId: FIRM_ID } }); }

  // Providers
  const providers = [
    { providerName: "Dr. Rodriguez", providerType: "orthopedist", facilityName: "Hempstead Orthopedics", firstVisitDate: new Date("2026-02-18"), treatmentOngoing: true, totalBilled: 12000, letterOfProtection: true, recordsObtained: true, billsObtained: true },
    { providerName: "Physical Therapy Associates", providerType: "physical_therapy", firstVisitDate: new Date("2026-03-01"), treatmentOngoing: true, totalBilled: 6000, recordsObtained: true },
    { providerName: "Hempstead Hospital ER", providerType: "emergency_room", firstVisitDate: new Date("2026-02-15"), lastVisitDate: new Date("2026-02-15"), treatmentOngoing: false, totalBilled: 4000, recordsObtained: true },
    { providerName: "Long Island Radiology", providerType: "radiologist", firstVisitDate: new Date("2026-02-25"), treatmentOngoing: false, totalBilled: 3500, recordsObtained: true },
    { providerName: "Dr. Park", providerType: "pain_management", firstVisitDate: new Date("2026-03-10"), treatmentOngoing: true, totalBilled: 3500, letterOfProtection: true, recordsObtained: true },
    { providerName: "Dr. Alan Marcus, MD", providerType: "orthopedist", facilityName: "IME Expert", firstVisitDate: new Date("2026-02-20"), treatmentOngoing: false, totalBilled: 5000, narrativeObtained: true },
  ];
  for (const p of providers) { await prisma.caseMedicalProvider.create({ data: { caseId: cc.id, ...p, firmId: FIRM_ID } }); }

  // Insurance
  await prisma.caseInsurancePolicy.create({ data: { caseId: cc.id, policyType: "auto_liability", carrier: "State Farm", policyNumber: "AU-789456123", insured: "John Doe (defendant)", policyLimits: 300000, claimNumber: "CL-2026-12345", adjustorName: "Mike Thompson", adjustorPhone: "(800) 555-0150", status: "accepted", firmId: FIRM_ID } });
  await prisma.caseInsurancePolicy.create({ data: { caseId: cc.id, policyType: "uninsured_motorist", carrier: "Geico", policyNumber: "UM-456789012", insured: "John Smith (client)", policyLimits: 100000, status: "active", notes: "Available if defendant's coverage insufficient", firmId: FIRM_ID } });

  // Budget
  const budgetItems = [
    { category: "filing_fee", description: "Court filing fees", estimatedAmount: 250, actualAmount: 210, status: "spent", priority: "required" },
    { category: "service_fee", description: "Service of process", estimatedAmount: 150, actualAmount: 125, status: "spent", priority: "required" },
    { category: "medical_records", description: "Medical records (all providers)", estimatedAmount: 1000, actualAmount: 850, status: "spent", priority: "required" },
    { category: "expert_medical", description: "Medical expert", estimatedAmount: 5000, actualAmount: 5000, status: "spent", priority: "required" },
    { category: "expert_accident_reconstruction", description: "Accident reconstruction (if needed)", estimatedAmount: 7500, actualAmount: 0, status: "projected", priority: "optional" },
    { category: "deposition_transcript", description: "Deposition transcripts", estimatedAmount: 4000, actualAmount: 3500, status: "spent", priority: "required" },
    { category: "investigation", description: "Scene investigation", estimatedAmount: 1500, actualAmount: 1200, status: "spent", priority: "recommended" },
    { category: "mediation_fee", description: "Mediation", estimatedAmount: 2500, actualAmount: 0, status: "projected", priority: "recommended" },
    { category: "other", description: "Copying, postage, misc", estimatedAmount: 600, actualAmount: 490, status: "spent", priority: "required" },
  ];
  for (const b of budgetItems) { await prisma.caseExpenseBudget.create({ data: { caseId: cc.id, ...b, firmId: FIRM_ID } }); }

  console.log("Contingency case seed complete!");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
