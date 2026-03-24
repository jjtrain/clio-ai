import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function rand(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

async function main() {
  console.log("Seeding benchmark data for 15 fictional firms...");
  const period = "2026-03";
  const practiceAreas = ["personal_injury", "family_law", "immigration", "corporate"];
  const firmIds = Array.from({ length: 15 }, (_, i) => `bench-firm-${String(i + 1).padStart(2, "0")}`);

  // Realistic ranges per metric per PA
  const ranges: Record<string, Record<string, [number, number]>> = {
    personal_injury: { avg_case_duration_days: [180, 550], avg_matter_revenue: [8000, 95000], collection_rate: [78, 98], avg_days_to_first_invoice: [30, 180], cac: [150, 800] },
    family_law: { avg_case_duration_days: [90, 365], avg_matter_revenue: [3000, 25000], collection_rate: [82, 97], avg_days_to_first_invoice: [5, 45], cac: [200, 900] },
    immigration: { avg_case_duration_days: [60, 540], avg_matter_revenue: [2500, 12000], collection_rate: [88, 99], avg_days_to_first_invoice: [3, 30], cac: [100, 600] },
    corporate: { avg_case_duration_days: [30, 180], avg_matter_revenue: [5000, 50000], collection_rate: [85, 98], avg_days_to_first_invoice: [7, 35], cac: [300, 1200] },
  };

  let snapCount = 0;
  for (const firmId of firmIds) {
    for (const pa of practiceAreas) {
      // Not every firm practices every area (skip ~20%)
      if (Math.random() < 0.2) continue;

      const paRanges = ranges[pa];
      for (const [metric, [min, max]] of Object.entries(paRanges)) {
        const value = rand(min, max);
        await prisma.benchmarkSnapshot.create({
          data: { firmId, practiceArea: pa, metric, value, period },
        });
        snapCount++;
      }
    }
  }

  // Add demo-firm's own data (slightly above median for most metrics)
  const demoValues: Record<string, Record<string, number>> = {
    personal_injury: { avg_case_duration_days: 320, avg_matter_revenue: 45000, collection_rate: 91, avg_days_to_first_invoice: 60, cac: 350 },
    family_law: { avg_case_duration_days: 180, avg_matter_revenue: 8500, collection_rate: 93, avg_days_to_first_invoice: 12, cac: 420 },
    immigration: { avg_case_duration_days: 210, avg_matter_revenue: 5500, collection_rate: 96, avg_days_to_first_invoice: 7, cac: 280 },
    corporate: { avg_case_duration_days: 65, avg_matter_revenue: 18000, collection_rate: 94, avg_days_to_first_invoice: 14, cac: 550 },
  };

  for (const [pa, metrics] of Object.entries(demoValues)) {
    for (const [metric, value] of Object.entries(metrics)) {
      const existing = await prisma.benchmarkSnapshot.findFirst({ where: { firmId: "demo-firm", practiceArea: pa, metric, period } });
      if (existing) {
        await prisma.benchmarkSnapshot.update({ where: { id: existing.id }, data: { value } });
      } else {
        await prisma.benchmarkSnapshot.create({ data: { firmId: "demo-firm", practiceArea: pa, metric, value, period } });
      }
      snapCount++;
    }
  }

  console.log(`Seeded ${snapCount} benchmark snapshots across ${firmIds.length + 1} firms.`);

  // Now rebuild platform benchmarks
  console.log("Rebuilding platform benchmarks...");
  const allSnapshots = await prisma.benchmarkSnapshot.findMany({ where: { period } });
  const groups: Record<string, number[]> = {};
  for (const s of allSnapshots) {
    const key = `${s.metric}::${s.practiceArea}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(s.value);
  }

  let benchCount = 0;
  for (const [key, values] of Object.entries(groups)) {
    if (values.length < 5) continue;
    const sorted = values.sort((a, b) => a - b);
    const p = (pct: number) => {
      const idx = (pct / 100) * (sorted.length - 1);
      const lo = Math.floor(idx);
      const hi = Math.ceil(idx);
      return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
    };
    const [metric, practiceArea] = key.split("::");

    await prisma.platformBenchmark.upsert({
      where: { metric_practiceArea_period: { metric, practiceArea, period } },
      create: { metric, practiceArea, p25: p(25), p50: p(50), p75: p(75), mean: sorted.reduce((s, v) => s + v, 0) / sorted.length, sampleSize: sorted.length, period },
      update: { p25: p(25), p50: p(50), p75: p(75), mean: sorted.reduce((s, v) => s + v, 0) / sorted.length, sampleSize: sorted.length },
    });
    benchCount++;
  }

  console.log(`Built ${benchCount} platform benchmarks.`);
  console.log("Benchmark seed complete!");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
