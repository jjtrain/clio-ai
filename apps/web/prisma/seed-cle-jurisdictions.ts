import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding CLE jurisdictions...");

  const jurisdictions = [
    {
      code: "NY", name: "New York", regulatoryBody: "New York State CLE Board", regulatoryBodyUrl: "https://www.nycourts.gov/attorneys/cle/",
      reportingPeriodType: "FIXED_BIENNIAL", reportingPeriodMonths: 24, totalCreditsRequired: 24,
      carryoverAllowed: true, carryoverMaxCredits: 6, gracePeriodDays: 30,
      reportingUrl: "https://www.nycourts.gov/attorneys/cle/",
      newAdmitteeRules: { firstTwoYears: true, bridgingTheGapRequired: true, totalCredits: 32 },
      notes: "NY attorneys admitted < 2 years must complete 32 credits including Bridging the Gap.",
      requirements: [
        { category: "ETHICS", creditsRequired: 4.0 },
        { category: "BIAS_ELIMINATION", creditsRequired: 1.0 },
        { category: "CYBERSECURITY", creditsRequired: 1.0 },
        { category: "MENTAL_HEALTH", creditsRequired: 1.0 },
        { category: "GENERAL", creditsRequired: 17.0 },
      ],
    },
    {
      code: "NJ", name: "New Jersey", regulatoryBody: "NJ MCLE Board", regulatoryBodyUrl: "https://www.njcourts.gov/attorneys/cle",
      reportingPeriodType: "CALENDAR_YEAR", reportingPeriodMonths: 24, totalCreditsRequired: 24,
      carryoverAllowed: false, gracePeriodDays: 0,
      requirements: [
        { category: "ETHICS", creditsRequired: 4.0 },
        { category: "GENERAL", creditsRequired: 20.0 },
      ],
    },
    {
      code: "CT", name: "Connecticut", regulatoryBody: "CT Judicial Branch", reportingPeriodType: "CALENDAR_YEAR",
      reportingPeriodMonths: 12, totalCreditsRequired: 12, carryoverAllowed: true, carryoverMaxCredits: 12,
      requirements: [{ category: "ETHICS", creditsRequired: 2.0 }, { category: "GENERAL", creditsRequired: 10.0 }],
    },
    {
      code: "FL", name: "Florida", regulatoryBody: "Florida Bar", reportingPeriodType: "FIXED_TRIENNIAL",
      reportingPeriodMonths: 36, totalCreditsRequired: 33, carryoverAllowed: false,
      requirements: [
        { category: "ETHICS", creditsRequired: 5.0 },
        { category: "MENTAL_HEALTH", creditsRequired: 3.0 },
        { category: "GENERAL", creditsRequired: 25.0 },
      ],
    },
    {
      code: "CA", name: "California", regulatoryBody: "State Bar of California", reportingPeriodType: "FIXED_TRIENNIAL",
      reportingPeriodMonths: 36, totalCreditsRequired: 25, carryoverAllowed: false,
      requirements: [
        { category: "ETHICS", creditsRequired: 4.0 },
        { category: "BIAS_ELIMINATION", creditsRequired: 2.0 },
        { category: "SUBSTANCE_ABUSE", creditsRequired: 1.0 },
        { category: "MENTAL_HEALTH", creditsRequired: 1.0 },
        { category: "GENERAL", creditsRequired: 17.0 },
      ],
    },
    {
      code: "TX", name: "Texas", regulatoryBody: "State Bar of Texas", reportingPeriodType: "ANNIVERSARY",
      reportingPeriodMonths: 12, totalCreditsRequired: 15, carryoverAllowed: true, carryoverMaxCredits: 15,
      requirements: [{ category: "ETHICS", creditsRequired: 3.0 }, { category: "GENERAL", creditsRequired: 12.0 }],
    },
    {
      code: "PA", name: "Pennsylvania", regulatoryBody: "PA CLE Board", reportingPeriodType: "FIXED_BIENNIAL",
      reportingPeriodMonths: 24, totalCreditsRequired: 24, carryoverAllowed: false,
      requirements: [{ category: "ETHICS", creditsRequired: 4.0 }, { category: "GENERAL", creditsRequired: 20.0 }],
    },
    {
      code: "MA", name: "Massachusetts", regulatoryBody: "MA MCLE", reportingPeriodType: "CALENDAR_YEAR",
      reportingPeriodMonths: 12, totalCreditsRequired: 12,
      requirements: [{ category: "GENERAL", creditsRequired: 12.0 }],
    },
    {
      code: "IL", name: "Illinois", regulatoryBody: "IL MCLE Board", reportingPeriodType: "FIXED_BIENNIAL",
      reportingPeriodMonths: 24, totalCreditsRequired: 30, carryoverAllowed: true, carryoverMaxCredits: 10,
      requirements: [{ category: "ETHICS", creditsRequired: 6.0 }, { category: "GENERAL", creditsRequired: 24.0 }],
    },
    {
      code: "GA", name: "Georgia", regulatoryBody: "State Bar of Georgia", reportingPeriodType: "CALENDAR_YEAR",
      reportingPeriodMonths: 12, totalCreditsRequired: 12,
      requirements: [{ category: "ETHICS", creditsRequired: 1.0 }, { category: "GENERAL", creditsRequired: 11.0 }],
    },
  ];

  for (const jur of jurisdictions) {
    const { requirements, ...jurData } = jur;
    const created = await prisma.cLEJurisdiction.upsert({
      where: { code: jur.code },
      create: { ...jurData, isActive: true },
      update: { name: jur.name, totalCreditsRequired: jur.totalCreditsRequired },
    });

    // Seed requirements
    for (const req of requirements) {
      const existing = await prisma.cLERequirementRule.findFirst({ where: { jurisdictionId: created.id, category: req.category } });
      if (!existing) {
        await prisma.cLERequirementRule.create({ data: { jurisdictionId: created.id, ...req } });
      }
    }
  }

  console.log(`Seeded ${jurisdictions.length} CLE jurisdictions with requirements.`);

  // Seed demo attorney CLE data
  const ny = await prisma.cLEJurisdiction.findUnique({ where: { code: "NY" }, include: { requirements: true } });
  if (ny) {
    const breakdown: Record<string, any> = {};
    for (const req of ny.requirements) {
      breakdown[req.category] = { earned: 0, required: req.creditsRequired, remaining: req.creditsRequired };
    }
    // Partially completed
    breakdown["ETHICS"] = { earned: 2.5, required: 4.0, remaining: 1.5 };
    breakdown["BIAS_ELIMINATION"] = { earned: 1.0, required: 1.0, remaining: 0 };
    breakdown["GENERAL"] = { earned: 14.0, required: 17.0, remaining: 3.0 };

    await prisma.attorneyCLEReq.upsert({
      where: { userId_jurisdictionId_periodStart: { userId: "demo-user", jurisdictionId: ny.id, periodStart: new Date("2024-01-01") } },
      create: {
        userId: "demo-user", firmId: "demo-firm", jurisdictionId: ny.id,
        periodStart: new Date("2024-01-01"), periodEnd: new Date("2025-12-31"),
        reportingDeadline: new Date("2026-01-31"), periodLabel: "2024–2025 Period",
        totalRequired: 24, totalEarned: 17.5, creditsRemaining: 6.5, pctComplete: 73,
        categoryBreakdown: breakdown,
      },
      update: {},
    });

    // Demo credits
    const credits = [
      { courseName: "NY Ethics Update 2024", provider: "Lawline", format: "ON_DEMAND_VIDEO", deliveryMethod: "ONLINE_ASYNCHRONOUS", totalCredits: 2.5, creditsByCategory: { ETHICS: 2.5 }, jurisdictions: ["NY"], completedAt: new Date("2024-06-15") },
      { courseName: "Eliminating Bias in Legal Practice", provider: "NYCLA", format: "LIVE_WEBINAR", deliveryMethod: "ONLINE_SYNCHRONOUS", totalCredits: 1.0, creditsByCategory: { BIAS_ELIMINATION: 1.0 }, jurisdictions: ["NY"], completedAt: new Date("2024-09-20") },
      { courseName: "Trial Advocacy Skills", provider: "PLI", format: "LIVE_IN_PERSON", deliveryMethod: "IN_PERSON", totalCredits: 6.0, creditsByCategory: { GENERAL: 6.0 }, jurisdictions: ["NY", "NJ"], completedAt: new Date("2024-04-12") },
      { courseName: "Litigation Strategy for PI Cases", provider: "West LegalEdcenter", format: "ON_DEMAND_VIDEO", deliveryMethod: "ONLINE_ASYNCHRONOUS", totalCredits: 4.0, creditsByCategory: { GENERAL: 4.0 }, jurisdictions: ["NY"], completedAt: new Date("2024-11-05") },
      { courseName: "Family Law Practice Update", provider: "NYSBA", format: "LIVE_WEBINAR", deliveryMethod: "ONLINE_SYNCHRONOUS", totalCredits: 4.0, creditsByCategory: { GENERAL: 4.0 }, jurisdictions: ["NY"], completedAt: new Date("2025-02-18") },
    ];

    const reqId = (await prisma.attorneyCLEReq.findFirst({ where: { userId: "demo-user", jurisdictionId: ny.id } }))?.id;
    for (const c of credits) {
      await prisma.cLECreditEntry.create({ data: { userId: "demo-user", firmId: "demo-firm", requirementId: reqId, ...c } });
    }
    console.log(`Seeded ${credits.length} demo CLE credits for NY.`);
  }

  console.log("CLE jurisdiction seeding complete!");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
