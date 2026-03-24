import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const FIRM_ID = "demo-firm";

async function main() {
  console.log("Seeding marketing spend data...");

  // 6 months of marketing spend across 4 practice areas and 6 sources
  const months = ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03"];

  const spendData: Array<{ source: string; practiceArea: string | null; monthlyAmounts: number[] }> = [
    // Google Ads — PI heavy
    { source: "google_ads", practiceArea: "personal_injury", monthlyAmounts: [2800, 3100, 2500, 3200, 2900, 3400] },
    { source: "google_ads", practiceArea: "family_law", monthlyAmounts: [800, 900, 700, 1000, 850, 950] },
    { source: "google_ads", practiceArea: "immigration", monthlyAmounts: [600, 700, 500, 800, 650, 750] },

    // Facebook/Social
    { source: "facebook_ads", practiceArea: "personal_injury", monthlyAmounts: [500, 600, 450, 700, 550, 650] },
    { source: "facebook_ads", practiceArea: "immigration", monthlyAmounts: [400, 450, 350, 500, 400, 475] },

    // Referral fees
    { source: "referral_fees", practiceArea: "personal_injury", monthlyAmounts: [1500, 2000, 1800, 2200, 1700, 2500] },
    { source: "referral_fees", practiceArea: "family_law", monthlyAmounts: [300, 400, 250, 500, 350, 400] },

    // Bar association
    { source: "bar_association", practiceArea: null, monthlyAmounts: [200, 200, 200, 200, 200, 200] },

    // Website/SEO (firm-wide)
    { source: "website_seo", practiceArea: null, monthlyAmounts: [1500, 1500, 1500, 1500, 1500, 1500] },

    // Events/networking
    { source: "events", practiceArea: null, monthlyAmounts: [0, 500, 0, 0, 750, 0] },
  ];

  let count = 0;
  for (const item of spendData) {
    for (let i = 0; i < months.length; i++) {
      if (item.monthlyAmounts[i] === 0) continue;

      // Use a unique key that won't conflict with the @@unique([source, period]) constraint
      const uniqueSource = item.practiceArea ? `${item.source}_${item.practiceArea}` : item.source;

      await prisma.marketingSpend.upsert({
        where: { source_period: { source: uniqueSource, period: months[i] } },
        create: {
          firmId: FIRM_ID,
          practiceArea: item.practiceArea,
          source: item.source,
          amount: item.monthlyAmounts[i],
          period: months[i],
          description: `${item.source.replace(/_/g, " ")}${item.practiceArea ? ` — ${item.practiceArea.replace(/_/g, " ")}` : " (firm-wide)"}`,
        },
        update: { amount: item.monthlyAmounts[i] },
      });
      count++;
    }
  }
  console.log(`Seeded ${count} marketing spend entries.`);

  // Tag some existing matters with intake sources
  const matters = await prisma.matter.findMany({ where: { status: "OPEN" }, take: 10 });
  const intakeSources = ["google_ads", "referral_fees", "website_seo", "bar_association", "facebook_ads", "walk_in"];

  for (let i = 0; i < matters.length; i++) {
    await prisma.matter.update({
      where: { id: matters[i].id },
      data: {
        intakeSource: intakeSources[i % intakeSources.length],
        intakeDate: matters[i].openDate,
      },
    });
  }
  console.log(`Tagged ${matters.length} matters with intake sources.`);

  console.log("CAC seed complete!");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
