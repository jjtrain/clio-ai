import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding report builder templates...");

  const templates = [
    {
      firmId: "demo-firm",
      name: "Revenue by Attorney",
      description: "Total billed and collected amounts grouped by attorney",
      isTemplate: true,
      config: {
        fields: ["attorney.name", "billing.totalBilled", "billing.collected", "billing.collectionRate"],
        filters: [],
        groupBy: "attorney.name",
        sortBy: "billing.totalBilled",
        sortDir: "desc",
        chartType: "bar",
        limit: 500,
      },
    },
    {
      firmId: "demo-firm",
      name: "Open Matters by Practice Area",
      description: "Count and breakdown of open matters per practice area",
      isTemplate: true,
      config: {
        fields: ["matter.name", "matter.practiceArea", "matter.status", "matter.openDate", "client.name"],
        filters: [{ field: "matter.status", operator: "in", value: ["OPEN", "PENDING"] }],
        groupBy: "matter.practiceArea",
        sortDir: "desc",
        chartType: "pie",
        limit: 500,
      },
    },
    {
      firmId: "demo-firm",
      name: "Collection Rate by Month",
      description: "Monthly collection rate trends across all matters",
      isTemplate: true,
      config: {
        fields: ["matter.openDate", "billing.totalBilled", "billing.collected", "billing.collectionRate", "billing.outstanding"],
        filters: [],
        sortBy: "matter.openDate",
        sortDir: "desc",
        chartType: "line",
        limit: 500,
      },
    },
    {
      firmId: "demo-firm",
      name: "Case Duration by Practice Area",
      description: "Average case duration grouped by practice area",
      isTemplate: true,
      config: {
        fields: ["matter.name", "matter.practiceArea", "matter.duration", "matter.openDate", "matter.closeDate", "matter.status"],
        filters: [],
        groupBy: "matter.practiceArea",
        sortBy: "matter.duration",
        sortDir: "desc",
        chartType: "bar",
        limit: 500,
      },
    },
  ];

  let count = 0;
  for (const t of templates) {
    const existing = await prisma.savedReport.findFirst({
      where: { firmId: t.firmId, name: t.name },
    });
    if (existing) {
      await prisma.savedReport.update({
        where: { id: existing.id },
        data: { config: t.config as any, description: t.description, isTemplate: t.isTemplate },
      });
    } else {
      await prisma.savedReport.create({ data: t as any });
    }
    count++;
  }

  console.log(`Seeded ${count} report builder templates.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
