import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FIRM_ID = "demo-firm";

async function main() {
  console.log("Seeding billing guidelines...");

  const guidelines = [
    {
      id: "guideline-block-billing",
      name: "No Block Billing",
      guidelineType: "block_billing_rule",
      rule: { enforceTaskSeparation: true, maxTasksPerEntry: 1 },
      description: "Each time entry must describe a single task with its own time allocation. Block billing (combining multiple tasks) is prohibited.",
      isDefault: true,
      source: "firm",
    },
    {
      id: "guideline-research-cap",
      name: "Research Time Cap",
      guidelineType: "task_time_limit",
      rule: { taskCategory: "research", maxHoursPerMonth: 15 },
      description: "Legal research is capped at 15 hours per matter per month without prior approval.",
      isDefault: true,
      source: "firm",
    },
    {
      id: "guideline-description-quality",
      name: "Description Requirements",
      guidelineType: "description_requirement",
      rule: { minWords: 5, requireSpecificDocument: true, requireActionVerb: true },
      description: "Time entry descriptions must include specific document names, legal issues, or party names. Generic descriptions like 'research' or 'work on case' are not acceptable.",
      isDefault: true,
      source: "firm",
    },
    {
      id: "guideline-rate-cap-default",
      name: "Default Rate Cap",
      guidelineType: "rate_cap",
      rule: { maxRate: 750 },
      description: "Maximum hourly rate is $750/hr for partners and $450/hr for associates.",
      isDefault: true,
      source: "firm",
    },
    {
      id: "guideline-no-overhead",
      name: "Non-Billable Overhead Tasks",
      guidelineType: "prohibited_task",
      rule: { keywords: ["file organization", "organize file", "internal meeting", "office administration", "update calendar", "billing review"] },
      description: "Administrative and overhead tasks should not be billed to clients.",
      isDefault: true,
      source: "firm",
    },
    {
      id: "guideline-travel-limit",
      name: "Travel Time Billing",
      guidelineType: "task_time_limit",
      rule: { taskCategory: "travel", maxHoursPerEntry: 4, requireDescription: true },
      description: "Travel time is billed at 50% rate. Maximum 4 hours per trip. Must include origin and destination.",
      isDefault: true,
      source: "firm",
    },
  ];

  for (const g of guidelines) {
    await prisma.billingGuideline.upsert({
      where: { id: g.id },
      create: {
        id: g.id,
        name: g.name,
        guidelineType: g.guidelineType,
        rule: g.rule,
        description: g.description,
        isDefault: g.isDefault,
        isActive: true,
        source: g.source,
        firmId: FIRM_ID,
      },
      update: {
        name: g.name,
        rule: g.rule,
        description: g.description,
      },
    });
  }

  console.log(`Seeded ${guidelines.length} billing guidelines.`);

  console.log("Seeding billing benchmarks...");

  const benchmarks = [
    // Research
    { id: "bench-research-general", taskCategory: "research", taskDescription: "General legal research per issue", minHours: 1.0, maxHours: 4.0, avgHours: 2.5, medianHours: 2.0, sampleSize: 500, source: "industry_benchmark" },
    { id: "bench-research-complex", taskCategory: "research", taskDescription: "Complex multi-jurisdictional research", minHours: 3.0, maxHours: 10.0, avgHours: 6.0, medianHours: 5.5, sampleSize: 200, source: "industry_benchmark" },

    // Drafting
    { id: "bench-draft-simple-motion", taskCategory: "drafting", taskDescription: "Simple motion (MTD, MTC)", minHours: 2.0, maxHours: 6.0, avgHours: 3.5, medianHours: 3.0, sampleSize: 400, source: "industry_benchmark" },
    { id: "bench-draft-complex-motion", taskCategory: "drafting", taskDescription: "Complex motion (MSJ, Daubert)", minHours: 6.0, maxHours: 20.0, avgHours: 12.0, medianHours: 10.0, sampleSize: 250, source: "industry_benchmark" },
    { id: "bench-draft-letter", taskCategory: "drafting", taskDescription: "Correspondence/demand letter", minHours: 0.5, maxHours: 2.0, avgHours: 1.0, medianHours: 0.8, sampleSize: 800, source: "industry_benchmark" },
    { id: "bench-draft-contract", taskCategory: "drafting", taskDescription: "Contract/agreement drafting", minHours: 2.0, maxHours: 10.0, avgHours: 5.0, medianHours: 4.0, sampleSize: 300, source: "industry_benchmark" },

    // Court appearances
    { id: "bench-court-conference", taskCategory: "court_appearance", taskDescription: "Status conference", minHours: 0.5, maxHours: 2.0, avgHours: 1.0, medianHours: 1.0, sampleSize: 600, source: "industry_benchmark" },
    { id: "bench-court-hearing", taskCategory: "court_appearance", taskDescription: "Motion hearing/oral argument", minHours: 1.0, maxHours: 4.0, avgHours: 2.0, medianHours: 1.5, sampleSize: 400, source: "industry_benchmark" },

    // Client communication
    { id: "bench-client-email", taskCategory: "client_communication", taskDescription: "Email correspondence", minHours: 0.1, maxHours: 0.5, avgHours: 0.2, medianHours: 0.2, sampleSize: 2000, source: "industry_benchmark" },
    { id: "bench-client-call", taskCategory: "client_communication", taskDescription: "Phone call with client", minHours: 0.2, maxHours: 1.0, avgHours: 0.4, medianHours: 0.3, sampleSize: 1500, source: "industry_benchmark" },
    { id: "bench-client-meeting", taskCategory: "client_communication", taskDescription: "In-person client meeting", minHours: 0.5, maxHours: 2.0, avgHours: 1.0, medianHours: 1.0, sampleSize: 500, source: "industry_benchmark" },

    // Discovery
    { id: "bench-discovery-review", taskCategory: "discovery", taskDescription: "Document review per 100 pages", minHours: 2.0, maxHours: 5.0, avgHours: 3.0, medianHours: 3.0, sampleSize: 300, source: "industry_benchmark" },
    { id: "bench-discovery-responses", taskCategory: "discovery", taskDescription: "Draft interrogatory responses", minHours: 2.0, maxHours: 8.0, avgHours: 4.0, medianHours: 3.5, sampleSize: 350, source: "industry_benchmark" },

    // Deposition
    { id: "bench-depo-prep", taskCategory: "deposition", taskDescription: "Deposition preparation", minHours: 2.0, maxHours: 8.0, avgHours: 4.0, medianHours: 3.5, sampleSize: 300, source: "industry_benchmark" },
    { id: "bench-depo-attend", taskCategory: "deposition", taskDescription: "Attend deposition", minHours: 2.0, maxHours: 8.0, avgHours: 4.0, medianHours: 4.0, sampleSize: 350, source: "industry_benchmark" },

    // Review
    { id: "bench-review-filing", taskCategory: "review", taskDescription: "Review court filing/brief", minHours: 0.5, maxHours: 3.0, avgHours: 1.5, medianHours: 1.0, sampleSize: 500, source: "industry_benchmark" },

    // Filing
    { id: "bench-filing-ecf", taskCategory: "filing", taskDescription: "E-filing with court", minHours: 0.2, maxHours: 1.0, avgHours: 0.4, medianHours: 0.3, sampleSize: 800, source: "industry_benchmark" },

    // Administrative
    { id: "bench-admin-general", taskCategory: "administrative", taskDescription: "Administrative tasks", minHours: 0.1, maxHours: 0.5, avgHours: 0.2, medianHours: 0.2, sampleSize: 1000, source: "industry_benchmark" },
  ];

  for (const b of benchmarks) {
    await prisma.billingBenchmark.upsert({
      where: { id: b.id },
      create: {
        id: b.id,
        taskCategory: b.taskCategory,
        taskDescription: b.taskDescription,
        minHours: b.minHours,
        maxHours: b.maxHours,
        avgHours: b.avgHours,
        medianHours: b.medianHours,
        sampleSize: b.sampleSize,
        source: b.source,
        firmId: null, // platform defaults
      },
      update: {
        minHours: b.minHours,
        maxHours: b.maxHours,
        avgHours: b.avgHours,
        medianHours: b.medianHours,
      },
    });
  }

  console.log(`Seeded ${benchmarks.length} billing benchmarks.`);
  console.log("Billing audit seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
