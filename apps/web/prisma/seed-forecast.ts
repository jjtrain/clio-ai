import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const FIRM_ID = "demo-firm";
const USER_ID = "demo-user";

async function main() {
  console.log("Seeding historical revenue...");
  const months = [
    { period: "2025-01", amount: 142000 }, { period: "2025-02", amount: 156000 }, { period: "2025-03", amount: 178000 },
    { period: "2025-04", amount: 165000 }, { period: "2025-05", amount: 172000 }, { period: "2025-06", amount: 188000 },
    { period: "2025-07", amount: 145000 }, { period: "2025-08", amount: 138000 }, { period: "2025-09", amount: 175000 },
    { period: "2025-10", amount: 185000 }, { period: "2025-11", amount: 168000 }, { period: "2025-12", amount: 198000 },
    { period: "2026-01", amount: 155000 }, { period: "2026-02", amount: 170000 }, { period: "2026-03", amount: 182000 },
  ];
  for (const m of months) {
    await prisma.historicalRevenue.upsert({
      where: { period_practiceArea_billingModel_firmId: { period: m.period, practiceArea: "", billingModel: "", firmId: FIRM_ID } },
      create: { period: m.period, practiceArea: null, billingModel: null, amount: m.amount, collectionRate: 0.93, firmId: FIRM_ID },
      update: { amount: m.amount },
    });
  }
  console.log(`Seeded ${months.length} months historical revenue.`);

  console.log("Seeding forecast assumptions...");
  const assumptions = [
    { name: "Hourly Collection Rate", category: "collection", parameterType: "percentage", defaultValue: 91, currentValue: 91, source: "historical_calculated" },
    { name: "Flat Fee Collection Rate", category: "collection", parameterType: "percentage", defaultValue: 96, currentValue: 96 },
    { name: "Average Days to Collect", category: "collection", parameterType: "days", defaultValue: 26, currentValue: 26 },
    { name: "Grade A Conversion Rate", category: "pipeline", parameterType: "percentage", defaultValue: 50, currentValue: 50 },
    { name: "Grade B Conversion Rate", category: "pipeline", parameterType: "percentage", defaultValue: 30, currentValue: 30 },
    { name: "Days from Retention to First Revenue", category: "pipeline", parameterType: "days", defaultValue: 45, currentValue: 45 },
    { name: "PI Pre-Lit Settlement Probability", category: "contingency", parameterType: "percentage", defaultValue: 40, currentValue: 40 },
    { name: "Avg Months Demand to Settlement", category: "contingency", parameterType: "days", defaultValue: 90, currentValue: 90 },
    { name: "New Matter Acquisition Rate", category: "growth", parameterType: "count", defaultValue: 6, currentValue: 6, description: "Average new matters per month" },
    { name: "Monthly Operating Expenses", category: "cost", parameterType: "amount", defaultValue: 45000, currentValue: 45000, description: "Fixed monthly overhead" },
  ];
  for (const a of assumptions) {
    await prisma.forecastAssumption.upsert({
      where: { name_firmId: { name: a.name, firmId: FIRM_ID } },
      create: { ...a, firmId: FIRM_ID },
      update: { currentValue: a.currentValue },
    });
  }
  console.log(`Seeded ${assumptions.length} assumptions.`);

  console.log("Seeding revenue goals...");
  const goals = [
    { period: "2026-Q2", periodType: "quarterly", goalAmount: 600000, notes: "Growth target: 10% over Q1" },
    { period: "2026-Q2", periodType: "quarterly", practiceArea: "personal_injury", goalAmount: 200000 },
    { period: "2026-Q2", periodType: "quarterly", practiceArea: "corporate", goalAmount: 150000, notes: "Aggressive growth" },
    { period: "2026-Q2", periodType: "quarterly", practiceArea: "family_law", goalAmount: 130000 },
    { period: "2026-Q2", periodType: "quarterly", practiceArea: "immigration", goalAmount: 70000 },
    { period: "2026", periodType: "annual", goalAmount: 2200000, notes: "Annual firm revenue target" },
  ];
  for (const g of goals) {
    await prisma.revenueGoal.upsert({
      where: { period_practiceArea_attorneyId_firmId: { period: g.period, practiceArea: g.practiceArea || "", attorneyId: "", firmId: FIRM_ID } },
      create: { ...g, practiceArea: g.practiceArea || null, firmId: FIRM_ID },
      update: { goalAmount: g.goalAmount },
    });
  }
  console.log(`Seeded ${goals.length} goals.`);

  // Demo forecast
  console.log("Seeding demo forecast...");
  const forecast = await prisma.revenueForecast.create({
    data: {
      forecastPeriod: "2026-Q2", periodType: "quarterly",
      totalProjectedRevenue: 520000, totalProjectedLow: 380000, totalProjectedHigh: 680000,
      totalConfirmed: 185000, totalProbable: 245000, totalPossible: 90000,
      byPracticeArea: { personal_injury: { low: 140000, mid: 195000, high: 260000 }, family_law: { low: 85000, mid: 115000, high: 140000 }, corporate: { low: 72000, mid: 98000, high: 125000 }, immigration: { low: 45000, mid: 62000, high: 85000 } },
      byMonth: { "2026-04": { total: 165000 }, "2026-05": { total: 178000 }, "2026-06": { total: 177000 } },
      aiInsights: "Your Q2 forecast of $520K represents 7.2% growth over Q1 actuals. Personal injury continues to be the strongest revenue driver at 37% of projected revenue, with cases in active negotiation expected to settle within 60 days. Corporate work shows a potential gap — current pipeline supports only 65% of the quarterly goal. Consider increasing marketing spend or activating dormant referral sources in the corporate space. Collection rate has improved to 93% this quarter.",
      userId: USER_ID, firmId: FIRM_ID,
      dataPoints: {
        create: [
          { source: "scheduled_payment", practiceArea: "family_law", projectedMonth: "2026-04", amount: 625, confidence: "confirmed", confidenceScore: 0.95, description: "Payment plan installment — Smith divorce — $625", firmId: FIRM_ID },
          { source: "subscription_recurring", practiceArea: "corporate", projectedMonth: "2026-04", amount: 1500, confidence: "confirmed", confidenceScore: 0.98, description: "Monthly retainer — Johnson Corp — $1,500", isRecurring: true, firmId: FIRM_ID },
          { source: "subscription_recurring", practiceArea: "corporate", projectedMonth: "2026-05", amount: 1500, confidence: "confirmed", confidenceScore: 0.98, description: "Monthly retainer — Johnson Corp — $1,500", isRecurring: true, firmId: FIRM_ID },
          { source: "pending_invoice", practiceArea: "immigration", projectedMonth: "2026-04", amount: 1500, confidence: "confirmed", confidenceScore: 0.85, description: "Invoice — Rodriguez immigration Phase 2 — $1,500", firmId: FIRM_ID },
          { source: "hourly_projection", practiceArea: "corporate", projectedMonth: "2026-04", amount: 2700, confidence: "probable", confidenceScore: 0.70, description: "Projected hourly overage — Johnson Corp — ~$2,700/month", firmId: FIRM_ID },
          { source: "hourly_projection", practiceArea: "family_law", projectedMonth: "2026-04", amount: 3800, confidence: "probable", confidenceScore: 0.65, description: "Projected hourly — Lee contested divorce — ~$3,800/month", firmId: FIRM_ID },
          { source: "contingency_expected", practiceArea: "personal_injury", projectedMonth: "2026-05", amount: 66660, confidence: "probable", confidenceScore: 0.55, description: "Projected fee — Smith v. Jones PI — $66,660 (after referral split)", firmId: FIRM_ID },
          { source: "flat_fee_phase", practiceArea: "immigration", projectedMonth: "2026-05", amount: 1000, confidence: "probable", confidenceScore: 0.60, description: "Immigration Phase 3 (Interview Prep) — $1,000", firmId: FIRM_ID },
          { source: "contingency_expected", practiceArea: "personal_injury", projectedMonth: "2026-06", amount: 44000, confidence: "possible", confidenceScore: 0.25, description: "Projected fee — Williams slip & fall — $44,000 at target", firmId: FIRM_ID },
          { source: "intake_pipeline", practiceArea: "personal_injury", projectedMonth: "2026-05", amount: 25000, confidence: "possible", confidenceScore: 0.20, description: "Grade A PI intake lead — projected avg revenue", firmId: FIRM_ID },
        ],
      },
    },
  });

  console.log("Revenue forecast seed complete!");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
